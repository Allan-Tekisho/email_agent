
import { EmailData, EmailStatus, Priority, Intent, Department } from '../types';

const API_BASE = '/api';

interface BackendEmail {
    id: number;
    subject: string;
    status: string;
    confidence: number;
    body_text: string;
    generated_reply: string | null;
    from_email: string;
    dept_name: string | null;
    created_at: string;
    // Missing fields in current backend query: priority, intention
}

export const api = {
    async getEmails(): Promise<{ emails: EmailData[], metrics: any }> {
        const response = await fetch(`${API_BASE}/emails`);
        if (!response.ok) throw new Error('Failed to fetch emails');
        const data = await response.json();
        const rows: BackendEmail[] = data.emails || [];

        const emails = rows.map(row => ({
            id: String(row.id),
            companyId: 'comp-1', // Default
            sender: row.from_email,
            subject: row.subject,
            body: row.body_text,
            receivedAt: row.created_at, // Real DB timestamp
            department: (row.dept_name as Department) || Department.SUPPORT, // Map or default
            priority: Priority.MEDIUM, // Fallback
            intent: Intent.REQUEST, // Fallback
            confidenceScore: row.confidence || 0,
            status: mapStatus(row.status),
            suggestedResponse: row.generated_reply || undefined,
            history: []
        }));

        return { emails, metrics: data.metrics };
    },

    async approveEmail(id: string): Promise<void> {
        await fetch(`${API_BASE}/emails/${id}/approve`, { method: 'POST' });
    },

    async rejectEmail(id: string): Promise<void> {
        await fetch(`${API_BASE}/emails/${id}/reject`, { method: 'POST' });
    },

    async uploadDocument(file: File, deptId: string): Promise<void> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('dept_id', deptId);
        await fetch(`${API_BASE}/documents`, {
            method: 'POST',
            body: formData
        });
    },

    async getDepartments(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/departments`);
        return res.json();
    },

    async updateDepartmentHead(id: string, headName: string, headEmail: string): Promise<void> {
        await fetch(`${API_BASE}/departments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ head_name: headName, head_email: headEmail })
        });
    }
};

function mapStatus(backendStatus: string): EmailStatus {
    // Map backend status strings to frontend enum
    switch (backendStatus) {
        case 'needs_review': return EmailStatus.NEEDS_REVIEW;
        case 'pending': return EmailStatus.PENDING;
        case 'human_answered': return EmailStatus.HUMAN_ANSWERED;
        case 'rag_answered': return EmailStatus.AI_ANSWERED;
        case 'archived': return EmailStatus.AUTO_RESOLVED;
        case 'processing': return EmailStatus.PROCESSING;
        default: return EmailStatus.PROCESSING; // Fallback
    }
}
