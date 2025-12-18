import { GoogleGenAI, Type } from "@google/genai";
import { Department, Priority, EmailData, DocumentItem, Intent } from '../types';

const getAiClient = () => {
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) { console.warn(e); }

  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const retrieveContext = (query: string, documents: DocumentItem[]): string => {
  const relevant = documents.filter(doc =>
    query.toLowerCase().includes(doc.department.toLowerCase()) ||
    doc.content.toLowerCase().split(' ').some(word => word.length > 4 && query.toLowerCase().includes(word))
  );

  if (relevant.length === 0) return "";
  return relevant.map(d => `Source: ${d.title}\nContent: ${d.content}`).join('\n\n');
};

export const classifyEmailWithGemini = async (
  subject: string,
  body: string
): Promise<{ department: Department; priority: Priority; intent: Intent; confidence: number }> => {
  const ai = getAiClient();
  if (!ai) {
    return { department: Department.SUPPORT, priority: Priority.MEDIUM, intent: Intent.REQUEST, confidence: 50 };
  }

  const prompt = `
    Analyze the following email.
    Classify Department: Sales, HR, Customer Support, Finance, Operations.
    Classify Priority: High, Medium, Low.
    Classify Intent: Request, Incident, Problem, Change.
    Assign Confidence (0-100) based on clarity.

    Subject: ${subject}
    Body: ${body}
  `;

  try {
    let result;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              department: { type: Type.STRING, enum: Object.values(Department) },
              priority: { type: Type.STRING, enum: Object.values(Priority) },
              intent: { type: Type.STRING, enum: Object.values(Intent) },
              confidence: { type: Type.NUMBER }
            },
            required: ["department", "priority", "intent", "confidence"]
          }
        }
      });
      result = JSON.parse(response.text || '{}');
    } catch (e) {
      console.warn("Gemini API failed, using mock classification:", e);
      return { department: Department.SUPPORT, priority: Priority.MEDIUM, intent: Intent.REQUEST, confidence: 50 };
    }

    return {
      department: result.department as Department,
      priority: result.priority as Priority,
      intent: result.intent as Intent,
      confidence: result.confidence
    };
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return { department: Department.SUPPORT, priority: Priority.LOW, intent: Intent.REQUEST, confidence: 0 };
  }
};

export const draftResponseWithGemini = async (
  email: EmailData,
  allDocuments: DocumentItem[]
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Error: API Key missing.";

  const context = retrieveContext(email.body + " " + email.subject, allDocuments);
  // Low confidence protocol
  const isLowConfidence = email.confidenceScore < 60;
  const isNoContext = context.length === 0;

  if (isLowConfidence || isNoContext) {
    return `Dear Sender,\n\nThank you for your email regarding "${email.subject}".\n\nWe have received your query. However, to ensure we provide the most accurate assistance, your request has been flagged for manual review by our ${email.department} specialist.\n\nWe will get back to you within 24 hours.\n\nBest regards,\nMailGuard AI Automated Agent`;
  }

  let systemInstruction = `You are a professional corporate email agent. Response must be polite, clear, and concise.`;
  let userPrompt = `
    Subject: ${email.subject}
    Body: ${email.body}
    Department: ${email.department}
    
    Relevant Internal Docs:
    ${context}

    Draft a response that answers the user's query using the docs.
    Mention the department head in CC.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: { systemInstruction, temperature: 0.3 }
    });
    return response.text || "Could not generate draft.";
  } catch (error) {
    console.warn("Gemini Draft API failed:", error);
    return "Thank you for your email. We have received your request and will process it shortly.\n\n(AI Draft Generation Failed)";
  }
};