const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    try {
        await client.connect();

        const depts = [
            { name: 'Sales', code: 'SALES' },
            { name: 'HR', code: 'HR' },
            { name: 'Customer Support', code: 'SUPP' },
            { name: 'Accounts & Finance', code: 'ACCT' },
            { name: 'Operations', code: 'OPS' }
        ];

        for (const d of depts) {
            try {
                // Try inserting name and code
                await client.query("INSERT INTO departments (name, code) VALUES ($1, $2)", [d.name, d.code]);
                console.log(`Inserted ${d.name}`);
            } catch (e) {
                console.log(`Error inserting ${d.name}:`, e.message);
            }
        }

        await client.end();
    } catch (err) {
        console.error("Connection Error:", err);
    }
}

seed();
