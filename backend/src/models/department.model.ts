import { query } from '../db';

export const DepartmentModel = {
    getAll: async () => {
        const res = await query('SELECT * FROM departments ORDER BY name');
        return res.rows;
    },

    getById: async (id: string | number) => {
        const res = await query('SELECT * FROM departments WHERE id = $1', [id]);
        return res.rows[0];
    },

    updateHead: async (id: string | number, headName: string, headEmail: string) => {
        return query('UPDATE departments SET head_name = $1, head_email = $2 WHERE id = $3', [headName, headEmail, id]);
    }
};
