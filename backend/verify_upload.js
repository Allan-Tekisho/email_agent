const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifyUpload() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT * 
            FROM kb_documents 
            LIMIT 5
        `);
        console.log("Recent KB Uploads:");
        console.table(res.rows);

        // Also check departments to map names
        if (res.rows.length > 0) {
            const deptId = res.rows[0].department_id;
            if (deptId) {
                const deptRes = await client.query('SELECT name FROM departments WHERE id = $1', [deptId]);
                console.log(`Latest upload belongs to department: ${deptRes.rows[0]?.name}`);
            }
        }

        await client.end();
    } catch (err) {
        console.error("Error:", err);
    }
}

verifyUpload();
