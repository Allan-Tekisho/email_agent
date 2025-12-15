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
        let deptRes = await query('SELECT id, head_email, head_name FROM departments WHERE name = $1', [department]);
        let deptData = deptRes.rows[0];

        if (!deptData) {
            deptRes = await query('SELECT id, head_email, head_name FROM departments WHERE name = $1', ['Other']);
            deptData = deptRes.rows[0];
        }

        const deptId = deptData?.id;
        const headEmail = deptData?.head_email;

        // Insert Email
        const insertRes = await query(
            'INSERT INTO emails (msg_id, subject, body, from_email, dept_id, priority, status, confidence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [email.msgId, email.subject, email.body, email.from, deptId, priority, 'PENDING', 0.8]
        );
        const newEmailId = insertRes.rows[0].id;

        // 2. Urgent Handling
        if (priority === 'HIGH') {
            console.log("URGENT email detected. Forwarding to Head:", headEmail);

            // Forward to Department Head
            // (We mock the send here, but in production this would use emailService.sendEmail logic)
            if (headEmail) {
                await emailService.sendEmail(
                    headEmail,
                    `[URGENT] Forwarded: ${email.subject}`,
                    `This urgent email was received from ${email.from}.\n\nBody:\n${email.body}`,
                    undefined // No msgId needed for internal forward
                );
            }

            // Mark as 'FORWARDED' or 'SENT' so it leaves the review queue? 
            // Or keep in queue but note it? Let's mark as REVIEW_QUEUE but with a note in logs.
            await query('INSERT INTO rag_logs (email_id, docs_used, generated_reply) VALUES ($1, $2, $3)',
                [newEmailId, '[]', 'URGENT: Forwarded to Dept Head']
            );

            await query('UPDATE emails SET status = $1 WHERE id = $2', ['REVIEW_QUEUE', newEmailId]);
        } else {
            // 3. Normal Flow (RAG & Draft)
            const context = await aiService.searchContext(email.body || '', department);
            const reply = await aiService.generateReply(email.subject || '', email.body || '', context);

            await query('INSERT INTO rag_logs (email_id, docs_used, generated_reply) VALUES ($1, $2, $3)',
                [newEmailId, JSON.stringify(context), reply]
            );

            console.log("Drafted reply:", reply);
            await query('UPDATE emails SET status = $1 WHERE id = $2', ['REVIEW_QUEUE', newEmailId]);
        }
    }
};
