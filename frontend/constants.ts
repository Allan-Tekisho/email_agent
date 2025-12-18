import { Department, EmailData, EmailStatus, Priority, DocumentItem, Intent, RagStats } from './types';

export const COMPANIES = [
  { id: 'c-1', name: 'Acme Corp' },
  { id: 'c-2', name: 'Globex Inc' }
];

export const MOCK_RAG_STATS: RagStats = {
  totalDocs: 247,
  avgUsage: 8.4,
  coverageGaps: 12,
  qualityScore: 94
};

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Return Policy 2024',
    department: Department.SUPPORT,
    content: 'Items can be returned within 30 days...',
    uploadDate: '2023-10-15',
    usageCount: 45,
    qualityScore: 96
  },
  {
    id: 'doc-2',
    title: 'Enterprise Features Overview',
    department: Department.SALES,
    content: 'The target for Q4 is $1.2M revenue...',
    uploadDate: '2023-11-01',
    usageCount: 38,
    qualityScore: 94
  },
  {
    id: 'doc-3',
    title: 'VPN Setup Guide',
    department: Department.IT,
    content: 'VPN disconnection issues are often caused by...',
    uploadDate: '2023-09-20',
    usageCount: 31,
    qualityScore: 95
  },
  {
    id: 'doc-4',
    title: 'Standard Mutual NDA',
    department: Department.LEGAL,
    content: 'Template for vendor relationships...',
    uploadDate: '2023-12-05',
    usageCount: 25,
    qualityScore: 93
  }
];

const createHistory = (action: string): any[] => [{
  id: `h-${Math.random()}`,
  timestamp: new Date().toISOString(),
  action,
  actor: 'System',
  details: 'Email ingested via SMTP'
}];

export const MOCK_EMAILS: EmailData[] = [
  {
    id: 'e-1',
    companyId: 'c-1',
    sender: 'customer@example.com',
    subject: 'Login Issues - User Cannot Access Dashboard',
    body: 'I have been trying to log into my account for the past hour but keep getting an error message.',
    receivedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    department: Department.SUPPORT,
    priority: Priority.HIGH,
    intent: Intent.PROBLEM,
    confidenceScore: 92,
    status: EmailStatus.NEW,
    citations: [{ source: 'Authentication Guide v2.3', usageCount: 12 }, { source: 'Common Login Issues FAQ', usageCount: 45 }],
    history: createHistory('Email Received')
  },
  {
    id: 'e-2',
    companyId: 'c-1',
    sender: 'cto@techcorp.com',
    subject: 'Enterprise Plan Pricing Inquiry',
    body: 'We are interested in your Enterprise plan for our team of 500 users.',
    receivedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    department: Department.SALES,
    priority: Priority.HIGH,
    intent: Intent.REQUEST,
    confidenceScore: 88,
    status: EmailStatus.NEW,
    citations: [{ source: 'Enterprise Features Overview', usageCount: 38 }, { source: 'Pricing Tiers 2024', usageCount: 15 }],
    history: createHistory('Email Received')
  },
  {
    id: 'e-3',
    companyId: 'c-1',
    sender: 'procurement@company.com',
    subject: 'NDA Template Request for Vendor',
    body: 'We need an NDA template for a new vendor relationship.',
    receivedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    department: Department.LEGAL,
    priority: Priority.MEDIUM,
    intent: Intent.REQUEST,
    confidenceScore: 78,
    status: EmailStatus.MANUAL_REVIEW,
    citations: [{ source: 'Legal Templates Library', usageCount: 25 }],
    history: createHistory('Email Received')
  },
  {
    id: 'e-4',
    companyId: 'c-1',
    sender: 'remote.worker@company.com',
    subject: 'VPN Connection Troubleshooting',
    body: 'My VPN keeps disconnecting every few minutes.',
    receivedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    department: Department.IT,
    priority: Priority.HIGH,
    intent: Intent.INCIDENT,
    confidenceScore: 91,
    status: EmailStatus.NEW,
    citations: [{ source: 'VPN Setup Guide', usageCount: 31 }],
    history: createHistory('Email Received')
  },
  {
    id: 'e-5',
    companyId: 'c-2',
    sender: 'newemployee@company.com',
    subject: 'Benefits Enrollment Deadline',
    body: 'When is the deadline for enrolling in health insurance benefits?',
    receivedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    department: Department.HR,
    priority: Priority.MEDIUM,
    intent: Intent.REQUEST,
    confidenceScore: 93,
    status: EmailStatus.AUTO_RESOLVED,
    citations: [{ source: 'New Hire Benefits Guide', usageCount: 19 }],
    history: createHistory('Email Received')
  }
];