import { query } from '../db';

export const EmailModel = {
    getPendingAndReview: async () => {
        return query(`
        SELECT e.id, e.subject, e.status, e.confidence_score as confidence,
               e.body_text, e.generated_reply, e.from_email,
               d.name as dept_name
        FROM emails e
        LEFT JOIN departments d ON e.classified_dept_id = d.id
        WHERE e.status = 'needs_review' OR e.status = 'pending'
        ORDER BY e.created_at DESC
    `);
    },

    getMetrics: async () => {
        const totalRes = await query('SELECT COUNT(*) as count FROM emails');
        const queueRes = await query("SELECT COUNT(*) as count FROM emails WHERE status = 'needs_review'");
        const sentRes = await query("SELECT COUNT(*) as count FROM emails WHERE status IN ('human_answered', 'rag_answered', 'fallback_sent')");
        const confRes = await query('SELECT AVG(confidence_score) as avg FROM emails');

        return {
            total: parseInt(totalRes.rows[0].count),
            queue: parseInt(queueRes.rows[0].count),
            sent: parseInt(sentRes.rows[0].count),
            avgConfidence: parseFloat(confRes.rows[0].avg) || 0
        };
    },

    getByIdWithDraft: async (id: string | number) => {
        const res = await query(`
        SELECT e.* 
        FROM emails e 
        WHERE e.id = $1
    `, [id]);
        return res.rows[0];
    },

    updateStatus: async (id: string | number, status: string) => {
        return query("UPDATE emails SET status = $1 WHERE id = $2", [status, id]);
    }
};
