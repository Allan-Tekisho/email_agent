const imaps = require('imap-simple');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    imap: {
        user: process.env.GMAIL_USER,
        password: process.env.GMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }, // Maintain the fix we applied
        authTimeout: 10000
    }
};

async function checkConnection() {
    console.log(`Testing connection for user: ${config.imap.user}`);
    try {
        const connection = await imaps.connect(config);
        console.log("SUCCESS: Connection established!");
        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error("FAILURE: Could not connect.");
        console.error(err);
        process.exit(1);
    }
}

checkConnection();
