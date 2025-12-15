import { EmailService } from './email.service';
import { AIService } from './ai.service';
import { query } from '../db';

const emailService = new EmailService();
const aiService = new AIService();

export const processEmails = async () => {
    console.log("Polling for new emails...");
    const emails = await emailService.fetchUnreadEmails();

    for (const email of emails) {
        console.log(`Processing email: ${email.subject}`);

        // 1. Classify
        const classification = await aiService.classifyEmail(email.subject || '', email.body || '');
        const { department, priority } = classification;

        // Save to DB
        // First get dept ID
        let deptRes = await query('SELECT id FROM departments WHERE name = $1', [department]);
        let deptId = deptRes.rows[0]?.id;
        if (!deptId) {
            deptRes = await query('SELECT id FROM departments WHERE name = $1', ['Other']);
            deptId = deptRes.rows[0]?.id;
        }

        const insertRes = await query(
            'INSERT INTO emails (msg_id, subject, body, from_email, dept_id, priority, status, confidence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [email.msgId, email.subject, email.body, email.from, deptId, priority, 'PENDING', 0.8] // Mock confidence for now
        );
        const newEmailId = insertRes.rows[0].id;

        // 2. RAG & Generate Reply
        const context = await aiService.searchContext(email.body || '', department);
        const reply = await aiService.generateReply(email.subject || '', email.body || '', context);

        await query('INSERT INTO rag_logs (email_id, docs_used, generated_reply) VALUES ($1, $2, $3)',
            [newEmailId, JSON.stringify(context), reply]
        );

        // 3. Auto-send or Queue
        // ...

        console.log("Drafted reply:", reply);

        await query('UPDATE emails SET status = $1 WHERE id = $2', ['REVIEW_QUEUE', newEmailId]);

        // If we wanted to autosend:
        // if (confidence > 0.75) {
        //    await emailService.sendEmail(email.from, "Re: " + email.subject, reply, undefined, headEmail);
        //    await query('UPDATE emails SET status = $1 WHERE id = $2', ['SENT', newEmailId]);
        // }
    }
};
