import { EmailService } from './email.service';
import { AIService } from './ai.service';
import { query } from '../db';

const emailService = new EmailService();
const aiService = new AIService();

export const processEmails = async () => {
    console.log("Polling for new emails...");
    const emails = await emailService.fetchUnreadEmails();

    console.log(`Found ${emails.length} unread email(s)`);

    if (emails.length === 0) {
        console.log("No new emails to process.");
        return;
    }

    for (const email of emails) {
        console.log(`Processing email: ${email.subject} from ${email.from}`);

        // Classify
        const classification = await aiService.classifyEmail(email.subject || '', email.body || '');
        const { department, priority } = classification;

        console.log(`Classified as: ${department} (Priority: ${priority})`);

        // Resolve Department ID
        let deptId: string | null = null;
        let headEmail: string | null = null;

        // Find Dept
        // Try strict match first
        let deptRes = await query('SELECT id, head_email FROM departments WHERE name = $1', [department]);

        // If not found, try case-insensitive match or 'Other'
        if (deptRes.rows.length === 0) {
            deptRes = await query('SELECT id, head_email FROM departments WHERE LOWER(name) = LOWER($1)', [department]);
        }

        if (deptRes.rows.length === 0) {
            console.log(`Department '${department}' not found in DB. Fallback to 'Other'.`);
            deptRes = await query("SELECT id, head_email FROM departments WHERE name = 'Other'");
        } else {
            console.log(`Department '${department}' found.`);
        }

        if (deptRes.rows.length > 0) {
            deptId = deptRes.rows[0].id;
            if (deptRes.rows[0].head_email) {
                headEmail = deptRes.rows[0].head_email;
            }
        } else {
            console.warn("Fatal: Even fallback 'Other' department not found.");
        }

        // Insert into emails table
        const insertRes = await query(
            `INSERT INTO emails (
                subject, body_text, from_email, classified_dept_id, status, confidence_score, priority
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                email.subject,
                email.body,
                email.from,
                deptId,
                'pending',
                0.8,
                (priority || 'medium').toLowerCase()
            ]
        );
        const newEmailId = insertRes.rows[0].id;

        // Generate Reply & Confidence Context (Performed early to support all flows)
        const context = await aiService.searchContext(email.body || '', department);
        const { reply, confidence } = await aiService.generateReply(email.subject || '', email.body || '', context, department);

        // Normalize confidence
        const confScore = confidence / 100;

        // Urgent Handling
        if (priority?.toLowerCase() === 'high') {
            console.log("URGENT email detected. Forwarding to Head:", headEmail);

            // Forward to Head
            if (headEmail) {
                await emailService.sendEmail(
                    headEmail,
                    `[URGENT] Forwarded: ${email.subject}`,
                    `This urgent email was received from ${email.from}.\n\nBody:\n${email.body}`,
                    undefined
                );
            }

            // AUTO-SEND Holding Reply if Low Confidence
            if (confidence < 50) {
                console.log(`URGENT + Low confidence (${confidence}%). Sending holding reply to user.`);
                await emailService.sendEmail(
                    email.from || '',
                    `Re: ${email.subject}`,
                    reply,
                    email.msgId,
                    undefined // No CC to head for the holding reply itself? Or yes? User didn't specify, but forwarding already happened.
                );
            }

            // Status remains needs_review (because it's high priority/forwarded)
            // But we should update generated_reply/confidence/rag_meta
            await query(`UPDATE emails SET status = 'needs_review', confidence_score = $3, generated_reply = $4, rag_meta = $2 WHERE id = $1`, [
                newEmailId,
                JSON.stringify({ note: 'URGENT: Forwarded to Dept Head', department_id: deptId, holding_sent: confidence < 50 }),
                confScore,
                reply
            ]);

        } else {
            // Normal Flow (Medium/Low)

            // Update Confidence and RAG meta in DB
            await query(
                `UPDATE emails SET confidence_score = $1, generated_reply = $2, rag_meta = $3 WHERE id = $4`,
                [confScore, reply, JSON.stringify({ used_chunks: context, auto_sent: false }), newEmailId]
            );

            // AUTO-SEND if Low Confidence (Holding Reply)
            if (confidence < 50) {
                console.log(`Low confidence (${confidence}%). Auto-sending holding reply.`);
                await emailService.sendEmail(
                    email.from || '',
                    `Re: ${email.subject}`,
                    reply,
                    email.msgId,
                    headEmail || undefined
                );
                await query(`UPDATE emails SET status = 'rag_answered', rag_meta = $2, sent_at = NOW() WHERE id = $1`, [
                    newEmailId,
                    JSON.stringify({ used_chunks: context, auto_sent: true })
                ]);

            }
            // AUTO-SEND if High Confidence (Answer)
            else {
                console.log(`High confidence (${confidence}%). Auto-sending answer.`);
                await emailService.sendEmail(
                    email.from || '',
                    `Re: ${email.subject}`,
                    reply,
                    email.msgId,
                    headEmail || undefined
                );
                await query(`UPDATE emails SET status = 'rag_answered', rag_meta = $2, sent_at = NOW() WHERE id = $1`, [
                    newEmailId,
                    JSON.stringify({ used_chunks: context, auto_sent: true })
                ]);
            }
        }
    }
};
