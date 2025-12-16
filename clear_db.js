const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clearEmails() {
    try {
        await client.connect();
        await client.query('TRUNCATE emails, email_review_queue CASCADE');
        console.log("Cleared all emails and review queue entries.");
        await client.end();
    } catch (err) {
        console.error(err);
    }
}

clearEmails();
