const fs = require('fs');
const path = require('path');

const backendEnv = `PORT=4000
DATABASE_URL=postgresql://postgres:Zl9SOdinLfcMwgd3@db.mghlwthrsewacxnmvssy.supabase.co:5432/postgres

# Email
GMAIL_USER="atomic01062002@gmail.com"
GMAIL_PASS="Atomic11@162002"


# AI (Deepseek + HuggingFace)
DEEPSEEK_API_KEY= "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"

# Vector DB (Pinecone)
PINECONE_API_KEY= "pcsk_4so4CA_BKR4TuqX27ZtVnUGNEv6WaALezcTkJ1i4GP8BmgkyyzS614U9TzoJrMwpFfCPPw"
`;

const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:4000
`;

fs.writeFileSync(path.join(__dirname, 'backend', '.env'), backendEnv);
fs.writeFileSync(path.join(__dirname, 'frontend', '.env.local'), frontendEnv);

console.log('Environment files updated!');
