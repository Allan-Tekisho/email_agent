import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { processEmails } from './services/processor';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

const PORT = process.env.PORT || 4000;

// Start loop
setInterval(async () => {
    console.log("Auto-processing...");
    try {
        await processEmails();
    } catch (e) {
        console.error("Auto-process failed:", e);
    }
}, 60000); // Poll every minute

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
