import { query } from '../db';

export const DepartmentModel = {
    getAll: async () => {
        const res = await query('SELECT * FROM departments ORDER BY name');
        return res.rows;
    },

    getById: async (id: string | number) => {
        const res = await query('SELECT * FROM departments WHERE id = $1', [id]);
        return res.rows[0];
    }
};
