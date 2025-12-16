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

        // Classify
        const classification = await aiService.classifyEmail(email.subject || '', email.body || '');
        const { department, priority } = classification;

        // Resolve Department ID
        let deptId: string | null = null;
        let headEmail: string | null = null;

        // Find Dept
        let deptRes = await query('SELECT id FROM departments WHERE name = $1', [department]);
        if (deptRes.rows.length === 0) {
            deptRes = await query('SELECT id FROM departments WHERE name = $1', ['Other']);
        }

        if (deptRes.rows.length > 0) {
            deptId = deptRes.rows[0].id;

            // Find Head Email via Join
            const headRes = await query(`
                SELECT u.email 
                FROM department_heads dh
                JOIN users u ON dh.user_id = u.id
                WHERE dh.department_id = $1 AND dh.is_primary = true
            `, [deptId]);

            if (headRes.rows.length > 0) {
                headEmail = headRes.rows[0].email;
            }
        }

        // Insert into emails table (New Schema)
        const insertRes = await query(
            `INSERT INTO emails (
                message_id, subject, body_text, from_email, primary_department_id, priority, status, confidence_score, to_email, received_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [
                email.msgId,
                email.subject,
                email.body,
                email.from,
                deptId,
                priority.toLowerCase(),
                'pending',
                0.8,
                'agent@company.com',
                new Date()
            ]
        );
        const newEmailId = insertRes.rows[0].id;

        // Urgent Handling
        if (priority === 'HIGH') {
            console.log("URGENT email detected. Forwarding to Head:", headEmail);

            if (headEmail) {
                await emailService.sendEmail(
                    headEmail,
                    `[URGENT] Forwarded: ${email.subject}`,
                    `This urgent email was received from ${email.from}.\n\nBody:\n${email.body}`,
                    undefined
                );
            }

            await query(`UPDATE emails SET status = 'needs_review' WHERE id = $1`, [newEmailId]);

            if (deptId) {
                await query(
                    'INSERT INTO rag_logs (email_id, department_id, used_chunks, auto_sent) VALUES ($1, $2, $3, $4)',
                    [newEmailId, deptId, JSON.stringify({ note: 'URGENT: Forwarded to Dept Head' }), false]
                );
            }

        } else {
            // Normal Flow
            const context = await aiService.searchContext(email.body || '', department);
            const reply = await aiService.generateReply(email.subject || '', email.body || '', context);

            if (deptId) {
                await query(
                    'INSERT INTO rag_logs (email_id, department_id, used_chunks, auto_sent) VALUES ($1, $2, $3, $4)',
                    [newEmailId, deptId, JSON.stringify(context), false]
                );
            }

            // Insert into Review Queue
            await query(
                `INSERT INTO email_review_queue (email_id, status, draft_reply_text) VALUES ($1, $2, $3)`,
                [newEmailId, 'needs_review', reply]
            );

            console.log("Drafted reply:", reply);
            await query(`UPDATE emails SET status = 'needs_review' WHERE id = $1`, [newEmailId]);
        }
    }
};
