const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' }); // Adjust path if needed

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkOrphans() {
    try {
        await client.connect();

        const res = await client.query(`
            SELECT e.id, e.subject, e.created_at, erq.id as queue_id
            FROM emails e
            LEFT JOIN email_review_queue erq ON e.id = erq.email_id
            WHERE erq.id IS NULL
        `);

        console.log(`Found ${res.rowCount} potential zombie emails (no review queue entry):`);
        res.rows.forEach(r => console.log(`- ${r.subject} (${r.id})`));

        await client.end();
    } catch (err) {
        console.error(err);
    }
}

checkOrphans();
