import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import axios from 'axios';

export class AIService {
    private openai;
    private pinecone: Pinecone | undefined;
    private indexName = process.env.PINECONE_INDEX || 'email-agent';

    constructor() {
        // Init OpenAI
        console.log("Initializing OpenAI Client...");
        // console.log("Base URL:", 'https://api.openai.com/v1'); // Default
        console.log("API Key (Prefix):", process.env.DEEPSEEK_API_KEY?.substring(0, 10)); // User put OpenAI key here

        this.openai = new OpenAI({
            // baseURL: 'https://api.deepseek.com', // REMOVED
            apiKey: process.env.DEEPSEEK_API_KEY,   // Using the var user populated
        });

        if (process.env.PINECONE_API_KEY) {
            this.pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        // Using HuggingFace Inference API for BAAI/bge-large-en-v1.5
        const model = "BAAI/bge-large-en-v1.5";
        const hfToken = process.env.HUGGINGFACE_API_KEY;

        try {
            const response = await axios.post(
                `https://router.huggingface.co/pipeline/feature-extraction/${model}`,
                { inputs: text },
                {
                    headers: {
                        Authorization: `Bearer ${hfToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            // Handle HF response format
            if (Array.isArray(response.data) && Array.isArray(response.data[0])) {
                return response.data[0];
            }
            return response.data;
        } catch (e: any) {
            console.error("HuggingFace Embedding Error", e.response?.data || e.message);
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
        
        Task: Draft a reply to this email and estimate your confidence (0-100) that the provided context answers the user's question.
        
        Rules:
        1. If context contains the answer -> High confidence (80-100). Draft professional reply.
        2. If context is partial -> Medium confidence (50-79). Draft reply with available info.
        3. If context is irrelevant/missing -> Low confidence (0-49). Draft a polite "holding reply" (we are reviewing your request).
        4. Sign off as "[Email-agent]". Do not use any other name.
        
        Context:
        ${contextDocs.join('\n---\n')}
        
        Email Subject: ${subject}
        Email Body: ${body}
        
        Output JSON only: { "reply": "...", "confidence": number }
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
            console.error("Reply generation error", e);
            return { reply: "Error generating reply.", confidence: 0 };
        }
    }

    async indexContent(text: string, metadata: any) {
        if (!this.pinecone) return;
        try {
            const index = this.pinecone.index(this.indexName);
            const embedding = await this.getEmbeddings(text);

            if (!embedding || embedding.length === 0) {
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

            if (!embedding || embedding.length === 0) return [];

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
