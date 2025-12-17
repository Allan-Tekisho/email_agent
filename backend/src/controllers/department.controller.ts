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
        // Not implemented in new schema yet
        res.status(501).json({ error: "Not implemented in new schema yet." });
    }
};
