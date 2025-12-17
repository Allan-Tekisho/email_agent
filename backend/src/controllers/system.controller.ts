import { Request, Response } from 'express';
import { processEmails } from '../services/processor';

export const SystemController = {
    process: async (req: Request, res: Response) => {
        try {
            await processEmails();
            res.json({ success: true, message: "Processing triggered" });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    simulate: async (req: Request, res: Response) => {
        try {
            res.json({ success: true, message: "Use the /process endpoint after sending real email or update code to support mock injection." });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
