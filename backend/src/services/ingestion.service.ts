const pdf = require('pdf-parse');

export class IngestionService {
    async parseFile(buffer: Buffer, mimetype: string): Promise<string> {
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        } else if (mimetype === 'text/plain') {
            return buffer.toString('utf-8');
        } else {
            throw new Error('Unsupported file type');
        }
    }

    chunkText(text: string, chunkSize: number = 500): string[] {
        // Simple chunking roughly by characters/words
        const chunks = [];
        let currentChunk = "";
        const sentences = text.split(/[.!?\n]/);

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            currentChunk += sentence + ". ";
        }
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
}
