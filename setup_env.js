const fs = require('fs');
const path = require('path');

const backendEnv = `PORT=4000
DATABASE_URL=postgresql://postgres:Zl9SOdinLfcMwgd3@db.mghlwthrsewacxnmvssy.supabase.co:5432/postgres

# Email
GMAIL_USER="atomic01062002@gmail.com"
GMAIL_PASS="ljez eurm ytug zume"


# AI (Deepseek + HuggingFace)
DEEPSEEK_API_KEY=" sk-708fb2e6d44f404c9b042f34dfd9b794"
HUGGINGFACE_API_KEY="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"

# Vector DB (Pinecone)
PINECONE_API_KEY="pcsk_4DGzxX_7ikgWxoPNxWb3PwdGc1npDXS4JHiM4omEEAXqNm2WqrTtYzqZ23aMAVLASgRhdW"
PINECONE_INDEX="email-agent"
`;

const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:4000
`;

fs.writeFileSync(path.join(__dirname, 'backend', '.env'), backendEnv);
fs.writeFileSync(path.join(__dirname, 'frontend', '.env.local'), frontendEnv);

console.log('Environment files updated!');
