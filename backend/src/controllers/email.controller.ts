import { Request, Response } from 'express';
import { EmailModel } from '../models/email.model';
import { EmailService } from '../services/email.service';

export const EmailController = {
    getPending: async (req: Request, res: Response) => {
        try {
            const emailsRes = await EmailModel.getPendingAndReview();
            const metrics = await EmailModel.getMetrics();

            res.json({
                emails: emailsRes.rows,
                metrics
            });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    approve: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const email = await EmailModel.getByIdWithDraft(id);
            if (!email) return res.status(404).send("Email not found");

            const emailService = new EmailService();
            // email.generated_reply comes from the updated model query
            await emailService.sendEmail(email.from_email, "Re: " + email.subject, email.generated_reply || "No reply generated", undefined);

            await EmailModel.updateStatus(id, 'human_answered');
            res.json({ success: true });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    },

    reject: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await EmailModel.updateStatus(id, 'archived');
            res.json({ success: true });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    }
};
