import imaps from 'imap-simple';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

export class EmailService {
    private transporter;
    private imapConfig;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS
            }
        });

        this.imapConfig = {
            imap: {
                user: process.env.GMAIL_USER || '',
                password: process.env.GMAIL_PASS || '',
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 10000
            }
        };
    }

    async sendEmail(to: string, subject: string, body: string, inReplyTo?: string, cc?: string) {
        console.log(`Sending email to ${to} (CC: ${cc}) with subject: ${subject}`);
        const mailOptions: any = {
            from: `"[Email-agent]" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text: body,
        };

        if (cc) {
            mailOptions.cc = cc;
        }

        if (inReplyTo) {
            mailOptions.inReplyTo = inReplyTo;
            mailOptions.references = inReplyTo;
        }

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully');
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }

    async fetchUnreadEmails() {
        try {
            const connection = await imaps.connect(this.imapConfig);
            await connection.openBox('INBOX');

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false // Keep as unread until processed? Or mark read. Let's keep unread for safety for now or mark read. User said "polls INBOX".
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            const emails = [];

            for (const item of messages) {
                const all = item.parts.find((part: any) => part.which === '');
                const id = item.attributes.uid;
                const idHeader = item.parts.find((part: any) => part.which === 'HEADER');

                // Parse the email
                const parsed = await simpleParser(all?.body || ''); // This might need raw body source. imap-simple returns parts.
                // Simplified for this MVP:
                // Actually imap-simple returns body as string or buffer.
                // Let's use a simpler approach for the MVP or assume `simpleParser` works on the stream.

                // For MVP robustness, let's just grab header subject and body if possible.
                // Correct logic for imap-simple with simpleParser:
                const fullBody = item.parts.find((p: any) => p.which === "")?.body;
                if (fullBody) {
                    const parsedMail = await simpleParser(fullBody);
                    emails.push({
                        uid: id,
                        from: parsedMail.from?.text,
                        subject: parsedMail.subject,
                        body: parsedMail.text,
                        msgId: parsedMail.messageId
                    });
                }
            }

            connection.end();
            return emails;
        } catch (error) {
            console.error('Error fetching emails:', error);
            return [];
        }
    }
}
