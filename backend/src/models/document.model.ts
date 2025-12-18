import { query } from '../db';

export const DocumentModel = {
    create: async (data: { title: string, dept_id: string, doc_type: string, storage_url: string, file_type: string, uploader_id?: string, status?: string, uploader_role?: string, content?: string }) => {
        const metadata = {
            title: data.title,
            storage_url: data.storage_url,
            file_type: data.file_type,
            uploader_id: data.uploader_id,
            status: data.status
        };

        const res = await query(`
        INSERT INTO kb_documents (department_id, content, doc_type, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [
            data.dept_id,
            data.content || '',
            data.doc_type || 'policy',
            JSON.stringify(metadata)
        ]);
        return res.rows[0];
    },

    // Add chunk logging if needed, though original code had it commented out mostly or separate. 
    // We'll leave it simple for now matching the existing server.ts logic.
};
