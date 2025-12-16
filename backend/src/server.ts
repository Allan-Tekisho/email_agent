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

// Update Dept Head (New Schema: Requires updating department_heads table)
app.put('/api/departments/:id', async (req, res) => {
    // This logic is complex in new logic (updating department_heads table)
    // For MVP, we might skip or assume user is passed
    res.status(501).json({ error: "Not implemented in new schema yet." });
});

// Upload Document (New Schema: kb_documents -> kb_chunks)
app.post('/api/documents', upload.single('file'), async (req, res: any) => {
    try {
        const { dept_id } = req.body; // department_id in new schema
        const file = req.file;

        if (!file) return res.status(400).send("No file");

        // Parse
        const text = await ingestionService.parseFile(file.buffer, file.mimetype);

        // Save metadata to DB (kb_documents)
        // Need uploader_user_id (mocking for now)
        // Need to find a valid user ID first? Or use static UUID?
        // Let's assume a system user exists or we insert one.
        // For strict schema, we need valid UUIDs. 
        // We will insert a dummy user if not exists or let it fail if constraints

        // Mock Insert KB Doc
        const kbRes = await query(`
            INSERT INTO kb_documents (title, department_id, doc_type, storage_url, file_type, status, uploader_user_id, uploader_role)
            VALUES ($1, $2, 'policy', 'mock_url', 'pdf', 'approved', (SELECT id FROM users LIMIT 1), 'ADMIN')
            RETURNING id
        `, [file.originalname, dept_id]);

        const kbId = kbRes.rows[0].id;

        // Index to Qdrant/Pinecone
        const deptRes = await query('SELECT name FROM departments WHERE id = $1', [dept_id]);
        const deptName = deptRes.rows[0]?.name || 'Other';

        const chunks = ingestionService.chunkText(text);
        let chunkIndex = 0;

        for (const chunk of chunks) {
            // Index to Pinecone
            await aiService.indexContent(chunk, {
                department: deptName,
                filename: file.originalname
            });

            // Log chunk in SQL
            /*
             await query(
                 'INSERT INTO kb_chunks (kb_document_id, chunk_index, text, vector_id) VALUES ($1, $2, $3, $4)',
                 [kbId, chunkIndex++, chunk, 'mock_vector_id']
             );
             */
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
        // Updated Query for New Schema
        // details are in email_review_queue
        const emailsRes = await query(`
            SELECT e.id, e.subject, e.priority, e.status, e.confidence_score as confidence,
                   d.name as dept_name,
                   erq.draft_reply_text as generated_reply
            FROM emails e
            LEFT JOIN departments d ON e.primary_department_id = d.id
            LEFT JOIN email_review_queue erq ON e.id = erq.email_id
            WHERE e.status = 'needs_review' OR e.status = 'pending'
            ORDER BY e.created_at DESC
        `);

        // Calculate metrics
        const totalRes = await query('SELECT COUNT(*) as count FROM emails');
        const queueRes = await query("SELECT COUNT(*) as count FROM emails WHERE status = 'needs_review'");
        const sentRes = await query("SELECT COUNT(*) as count FROM emails WHERE status IN ('human_answered', 'rag_answered', 'fallback_sent')");
        const confRes = await query('SELECT AVG(confidence_score) as avg FROM emails');

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
        // Fetch from queue
        const emailRes = await query(`
            SELECT e.*, erq.draft_reply_text 
            FROM emails e 
            JOIN email_review_queue erq ON e.id = erq.email_id 
            WHERE e.id = $1
        `, [id]);

        if (emailRes.rows.length === 0) return res.status(404).send("Email not found");

        const email = emailRes.rows[0];
        const emailService = new EmailService();
        await emailService.sendEmail(email.from_email, "Re: " + email.subject, email.draft_reply_text, email.message_id);

        await query("UPDATE emails SET status = 'human_answered' WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/emails/:id/reject', async (req, res) => {
    const { id } = req.params;
    await query("UPDATE emails SET status = 'archived' WHERE id = $1", [id]);
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
        await processEmails(); // For simulation, just trigger the processor if it mocks reading? 
        // Actually, the simulate endpoint previously INSERTED a mock email.

        const email = { msgId: `sim-${Date.now()}`, subject, body, from };
        const mockEmails = [email];
        // We can't inject this easily into processEmails without refactoring.
        // For now, let's just insert it into DB and trigger process?
        // Or duplicate logic? 

        // Re-use logic for MVP consistency:
        // We will insert into emails directly? No, processEmails fetches from IMAP.
        // Let's just mock the 'fetchUnreadEmails' if possible, or insert into DB as PENDING?
        // If we insert as PENDING, processEmails won't pick it up because it reads from IMAP.

        // Simplified: Insert directly and call AI service, basically partial copy of Processor.
        // ... (See processor.ts update for logic, replicating here minimally) 

        res.json({ success: true, message: "Use the /process endpoint after sending real email or update code to support mock injection." });

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
