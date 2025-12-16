const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkEnumDetails() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'email_priority'
            ORDER BY e.enumsortorder;
        `);
        console.log("Exact Enum Labels:");
        res.rows.forEach(r => console.log(`'${r.enumlabel}'`)); // Wrap in quotes to see whitespace
        await client.end();
    } catch (err) {
        console.error(err);
    }
}

checkEnumDetails();
