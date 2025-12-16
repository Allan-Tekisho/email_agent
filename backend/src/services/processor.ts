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
            const { reply, confidence } = await aiService.generateReply(email.subject || '', email.body || '', context);

            // Normalize confidence to 0.0-1.0 for DB
            const confScore = confidence / 100;

            if (deptId) {
                await query(
                    'INSERT INTO rag_logs (email_id, department_id, used_chunks, auto_sent) VALUES ($1, $2, $3, $4)',
                    [newEmailId, deptId, JSON.stringify(context), false]
                );
            }

            // Update Confidence in DB
            await query(`UPDATE emails SET confidence_score = $1 WHERE id = $2`, [confScore, newEmailId]);

            // AUTO-SEND if Low Confidence (Holding Reply)
            if (confidence < 50) {
                console.log(`Low confidence (${confidence}%). Auto-sending holding reply.`);
                await emailService.sendEmail(
                    email.from || '',
                    `Re: ${email.subject}`,
                    reply,
                    email.msgId
                );
                await query(`UPDATE emails SET status = 'human_answered' WHERE id = $1`, [newEmailId]);

            }
            // AUTO-SEND if High Confidence (Answer) - Now >= 50% covers everything else
            else {
                console.log(`High confidence (${confidence}%). Auto-sending answer.`);
                await emailService.sendEmail(
                    email.from || '',
                    `Re: ${email.subject}`,
                    reply,
                    email.msgId
                );
                await query(`UPDATE emails SET status = 'rag_answered' WHERE id = $1`, [newEmailId]);
            }
        }
    }
};
