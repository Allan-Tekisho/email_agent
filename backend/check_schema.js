const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'departments';
        `);
        const fs = require('fs');
        fs.writeFileSync('schema_info.json', JSON.stringify(res.rows, null, 2));
        await client.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
