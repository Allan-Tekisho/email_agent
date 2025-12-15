import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { processEmails } from './services/processor';
import { query } from './db';
import { EmailService } from './services/email.service';
import { IngestionService } from './services/ingestion.service';
import { AIService } from './services/ai.service';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer();
const ingestionService = new IngestionService();
const aiService = new AIService();

const PORT = process.env.PORT || 4000;

// Update Dept Head
// Update Dept Head
app.put('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    const { head_name, head_email } = req.body;
    try {
        await query('UPDATE departments SET head_name = $1, head_email = $2 WHERE id = $3', [head_name, head_email, id]);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Upload Document
app.post('/api/documents', upload.single('file'), async (req, res: any) => {
    try {
        const { dept_id } = req.body;
        const file = req.file;

        if (!file) return res.status(400).send("No file");

        // Parse
        const text = await ingestionService.parseFile(file.buffer, file.mimetype);

        // Save metadata to DB
        await query('INSERT INTO knowledge_docs (filename, content_summary, dept_id) VALUES ($1, $2, $3)',
            [file.originalname, text.substring(0, 200) + '...', dept_id]
        );

        // Index to Qdrant
        const deptRes = await query('SELECT name FROM departments WHERE id = $1', [dept_id]);
        const deptName = deptRes.rows[0]?.name || 'Other';

        const chunks = ingestionService.chunkText(text);
        for (const chunk of chunks) {
            await aiService.indexContent(chunk, {
                department: deptName,
                filename: file.originalname
            });
        }

        res.json({ success: true, chunks: chunks.length });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/departments', async (req, res) => {
    const result = await query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
});

// API Routes
app.get('/api/emails', async (req, res) => {
    try {
        // Fetch emails in Review Queue
        const emailsRes = await query(`
            SELECT e.*, d.name as dept_name, r.generated_reply 
            FROM emails e
            LEFT JOIN departments d ON e.dept_id = d.id
            LEFT JOIN rag_logs r ON e.id = r.email_id
            WHERE e.status = 'REVIEW_QUEUE' OR e.status = 'PENDING'
            ORDER BY e.created_at DESC
        `);

        // Calculate metrics
        const totalRes = await query('SELECT COUNT(*) as count FROM emails');
        const queueRes = await query("SELECT COUNT(*) as count FROM emails WHERE status = 'REVIEW_QUEUE'");
        const sentRes = await query("SELECT COUNT(*) as count FROM emails WHERE status = 'SENT'");
        const confRes = await query('SELECT AVG(confidence) as avg FROM emails');

        res.json({
            emails: emailsRes.rows,
            metrics: {
                total: parseInt(totalRes.rows[0].count),
                queue: parseInt(queueRes.rows[0].count),
                sent: parseInt(sentRes.rows[0].count),
                avgConfidence: parseFloat(confRes.rows[0].avg) || 0
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/emails/:id/approve', async (req, res) => {
    const { id } = req.params;
    try {
        // Logic to send existing draft
        const emailRes = await query('SELECT e.*, r.generated_reply FROM emails e JOIN rag_logs r ON e.id = r.email_id WHERE e.id = $1', [id]);
        if (emailRes.rows.length === 0) return res.status(404).send("Email not found");

        const email = emailRes.rows[0];
        const emailService = new EmailService();
        await emailService.sendEmail(email.from_email, "Re: " + email.subject, email.generated_reply, email.msg_id);

        await query("UPDATE emails SET status = 'SENT' WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/emails/:id/reject', async (req, res) => {
    const { id } = req.params;
    await query("UPDATE emails SET status = 'SKIPPED' WHERE id = $1", [id]);
    res.json({ success: true });
});

// Trigger processing manually (for demo/testing)
app.post('/api/process', async (req, res) => {
    try {
        await processEmails();
        res.json({ success: true, message: "Processing triggered" });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Simulation Endpoint
app.post('/api/simulate', async (req, res) => {
    const { subject, body, from } = req.body;
    try {
        const email = { msgId: `sim-${Date.now()}`, subject, body, from };

        const { AIService } = require('./services/ai.service');
        const aiService = new AIService();

        // 1. Classify
        const classification = await aiService.classifyEmail(subject, body);
        const { department, priority } = classification;

        let deptRes = await query('SELECT id FROM departments WHERE name = $1', [department]);
        let deptId = deptRes.rows[0]?.id;
        if (!deptId) {
            deptRes = await query('SELECT id FROM departments WHERE name = $1', ['Other']);
            deptId = deptRes.rows[0]?.id;
        }

        // SQLite RETURNING clause works in newer versions.
        const insertRes = await query(
            'INSERT INTO emails (msg_id, subject, body, from_email, dept_id, priority, status, confidence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [email.msgId, subject, body, from, deptId, priority, 'REVIEW_QUEUE', 0.85]
        );
        const newEmailId = insertRes.rows[0].id;

        // 2. RAG & Generate Reply
        const context = await aiService.searchContext(body, department);
        const reply = await aiService.generateReply(subject, body, context);

        await query('INSERT INTO rag_logs (email_id, docs_used, generated_reply) VALUES ($1, $2, $3)',
            [newEmailId, JSON.stringify(context), reply]
        );

        res.json({ success: true, id: newEmailId, status: 'REVIEW_QUEUE' });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


// Start loop
setInterval(async () => {
    console.log("Auto-processing...");
    try {
        await processEmails();
    } catch (e) {
        console.error("Auto-process failed:", e);
    }
}, 60000); // Poll every minute

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
