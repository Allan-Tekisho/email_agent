const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkEnums() {
    try {
        await client.connect();
        console.log("Connected. Querying enums...");

        // Query to find enum values for 'email_status' (inferred from error message)
        const res = await client.query("SELECT enum_range(NULL::email_status)");
        console.log("Valid 'email_status' values:", res.rows[0].enum_range);

        // Also check 'priority' just in case
        try {
            const resP = await client.query("SELECT enum_range(NULL::priority)"); // Guessing type name
            console.log("Valid 'priority' values:", resP.rows[0].enum_range);
        } catch (e) {
            console.log("Could not query priority enum (might be named differently).");
        }

        await client.end();
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkEnums();
