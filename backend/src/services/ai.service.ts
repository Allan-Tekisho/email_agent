import OpenAI from 'openai';
import axios from 'axios';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';

export class AIService {
    private openai;
    private pinecone: Pinecone | undefined;
    private indexName = 'email-agent-index';
    private hfToken;

    constructor() {
        // Init Deepseek (OpenAI Compatible)
        this.openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY || 'dummy',
        });

        this.hfToken = process.env.HUGGINGFACE_API_KEY;

        if (process.env.PINECONE_API_KEY) {
            this.pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        // Use HuggingFace Inference API for 'all-mpnet-base-v2' (768 dim)
        try {
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/sentence-transformers/all-mpnet-base-v2",
                { inputs: text },
                {
                    headers: { Authorization: `Bearer ${this.hfToken}` }
                }
            );

            if (response.data && response.data.error) {
                console.error("HF Error:", response.data.error);
                return []; // Fail gracefully or retry
            }
            // Check format (array of numbers)
            if (Array.isArray(response.data) && typeof response.data[0] === 'number') {
                return response.data;
            }
            // Sometimes it returns [ [num, num...] ]
            if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
                return response.data[0];
            }
            return [];
        } catch (e) {
            console.error("Embedding Error", e);
            return [];
        }
    }

    async classifyEmail(subject: string, body: string) {
        const prompt = `
        Classify this email into one of these departments: Sales, Support, HR, Finance, Operations, Other.
        Also assign a priority: HIGH, MEDIUM, LOW.
        
        Email Subject: ${subject}
        Email Body: ${body}
        
        Output JSON only: {"department": "...", "priority": "..."}
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "deepseek-chat",
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content || "{}";
            return JSON.parse(content);
        } catch (e) {
            console.error("Classification error", e);
            return { department: "Other", priority: "MEDIUM" };
        }
    }

    async generateReply(subject: string, body: string, contextDocs: string[]) {
        const prompt = `
        You are a helpful Email Agent. Draft a reply to this email.
        Use the context provided if relevant.
        
        Context:
        ${contextDocs.join('\n---\n')}
        
        Email Subject: ${subject}
        Email Body: ${body}
        
        Draft a professional reply.
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "deepseek-chat",
            });
            return completion.choices[0].message.content || "";
        } catch (e) {
            console.error("Reply generation error", e);
            return "Error generating reply.";
        }
    }

    async indexContent(text: string, metadata: any) {
        if (!this.pinecone) return;
        try {
            const index = this.pinecone.index(this.indexName);
            const embedding = await this.getEmbeddings(text);

            if (embedding.length === 0) {
                console.error("Skipping indexing due to embedding failure");
                return;
            }

            await index.upsert([
                {
                    id: crypto.randomUUID(),
                    values: embedding,
                    metadata: {
                        content: text,
                        ...metadata
                    }
                }
            ]);
            console.log("Indexed content to Pinecone for dept:", metadata.department);
        } catch (e) {
            console.error("Pinecone Indexing failed", e);
        }
    }

    async searchContext(queryText: string, department: string) {
        if (!this.pinecone) return [];
        try {
            const index = this.pinecone.index(this.indexName);
            const embedding = await this.getEmbeddings(queryText);

            if (embedding.length === 0) return [];

            const searchResult = await index.query({
                vector: embedding,
                topK: 3,
                includeMetadata: true,
                filter: {
                    department: { $eq: department }
                }
            });

            return searchResult.matches.map(res => res.metadata?.content as string || '');
        } catch (e) {
            console.log("Pinecone search failed:", e);
            return [];
        }
    }
}
