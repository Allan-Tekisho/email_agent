import { Request, Response } from 'express';
import { IngestionService } from '../services/ingestion.service';
import { AIService } from '../services/ai.service';
import { DocumentModel } from '../models/document.model';
import { DepartmentModel } from '../models/department.model';

const ingestionService = new IngestionService();
const aiService = new AIService();

export const DocumentController = {
    upload: async (req: Request, res: Response) => {
        try {
            const { dept_id } = req.body;
            const file = req.file;

            if (!file) return res.status(400).send("No file");

            const text = await ingestionService.parseFile(file.buffer, file.mimetype);

            // Indexing first or DB first? Server.ts did parse -> insert -> index.

            const kbDoc = await DocumentModel.create({
                title: file.originalname,
                dept_id,
                file_type: 'pdf',
                doc_type: 'policy',
                storage_url: 'mock_url',
                content: text
            });

            // Get Dept Name
            const dept = await DepartmentModel.getById(dept_id);
            const deptName = dept?.name || 'Other';

            const chunks = ingestionService.chunkText(text);

            for (const chunk of chunks) {
                await aiService.indexContent(chunk, {
                    department: deptName,
                    filename: file.originalname
                });
            }

            res.json({ success: true, chunks: chunks.length });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    }
};
