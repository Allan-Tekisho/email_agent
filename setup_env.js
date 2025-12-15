const fs = require('fs');
const path = require('path');

const backendEnv = `PORT=4000
DATABASE_URL=postgresql://admin:password123@localhost:5432/email_agent_db

# Email
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password

# AI (Deepseek + HuggingFace)
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_KEY
HUGGINGFACE_API_KEY=YOUR_HF_KEY

# Vector DB (Pinecone)
PINECONE_API_KEY=YOUR_PINECONE_KEY
`;

const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:4000
`;

fs.writeFileSync(path.join(__dirname, 'backend', '.env'), backendEnv);
fs.writeFileSync(path.join(__dirname, 'frontend', '.env.local'), frontendEnv);

console.log('Environment files updated!');
