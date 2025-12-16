const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

console.log("Testing connection to:", process.env.DATABASE_URL?.split('@')[1] || "Unknown URL"); // Log host only for safety

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        console.log("Connecting...");
        await client.connect();
        console.log("Connected successfully!");
        const res = await client.query('SELECT NOW()');
        console.log("Database Time:", res.rows[0]);
        await client.end();
    } catch (err) {
        console.error("Connection Failed:", err);
    }
}

test();
