const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config(); // defaults to .env in current dir

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkEnums() {
    try {
        await client.connect();

        // Query to find enum values for 'email_status' 
        const res = await client.query("SELECT enum_range(NULL::email_status)");
        console.log("Valid 'email_status' values:", res.rows[0].enum_range);

        await client.end();
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkEnums();
