import { Request, Response } from 'express';
import { DepartmentModel } from '../models/department.model';

export const DepartmentController = {
    getAll: async (req: Request, res: Response) => {
        try {
            const depts = await DepartmentModel.getAll();
            res.json(depts);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    updateHead: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { head_name, head_email } = req.body;

        if (!head_name || !head_email) {
            return res.status(400).json({ error: "head_name and head_email are required" });
        }

        try {
            await DepartmentModel.updateHead(id, head_name, head_email);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

};
