import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';

export class AIService {
    private openai;
    private pinecone: Pinecone | undefined;
    private indexName = 'email-agent-index';

    constructor() {
        // Init OpenAI (Standard)
        this.openai = new OpenAI({
            apiKey: process.env.DEEPSEEK_API_KEY, // Reusing existing env, but this will be your OpenAI key
        });

        if (process.env.PINECONE_API_KEY) {
            this.pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
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
                model: "gpt-4o",
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
        You are a helpful Email Agent. 
        
        Task: Draft a reply to this email.
        
        Rules:
        1. If the provided context contains the answer, draft a professional reply answering the user's question.
        2. If the context is NOT sufficient or relevant to answer the specific question, draft a polite "holding reply" stating that the team is reviewing their request and will respond within 24 hours. 
        3. Do NOT make up facts.
        
        Context:
        ${contextDocs.join('\n---\n')}
        
        Email Subject: ${subject}
        Email Body: ${body}
        `;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o",
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
