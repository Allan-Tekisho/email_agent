const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDepts() {
    try {
        await client.connect();
        const res = await client.query("SELECT * FROM departments");
        console.log("Department Count:", res.rows.length);
        if (res.rows.length > 0) {
            console.log("Departments:", res.rows.map(d => d.name).join(', '));
        }
        await client.end();
    } catch (err) {
        console.error("Error:", err);
    }
}

checkDepts();
