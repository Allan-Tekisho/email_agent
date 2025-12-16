const pdf = require('pdf-parse');
const mammoth = require('mammoth');

export class IngestionService {
    async parseFile(buffer: Buffer, mimetype: string): Promise<string> {
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            return data.text;
        } else if (mimetype === 'text/plain') {
            return buffer.toString('utf-8');
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: buffer });
            return result.value;
        } else {
            console.log("Unsupported mimetype:", mimetype);
            throw new Error('Unsupported file type: ' + mimetype);
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
