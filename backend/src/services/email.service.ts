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
        console.log('Connecting to IMAP server...');
        console.log('IMAP User:', process.env.GMAIL_USER);

        try {
            const connection = await imaps.connect(this.imapConfig);
            console.log('IMAP Connected successfully');

            await connection.openBox('INBOX');
            console.log('Opened INBOX');

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: true // Mark as seen after fetching to avoid reprocessing
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            console.log(`Found ${messages.length} UNSEEN messages in INBOX`);

            const emails = [];

            for (const item of messages) {
                try {
                    const id = item.attributes.uid;
                    const fullBody = item.parts.find((p: any) => p.which === "")?.body;

                    if (fullBody) {
                        const parsedMail = await simpleParser(fullBody);
                        console.log(`Parsed email UID ${id}: Subject="${parsedMail.subject}" From="${parsedMail.from?.text}"`);

                        emails.push({
                            uid: id,
                            from: parsedMail.from?.text,
                            subject: parsedMail.subject,
                            body: parsedMail.text,
                            msgId: parsedMail.messageId
                        });
                    } else {
                        console.log(`Email UID ${id}: No body found`);
                    }
                } catch (parseError) {
                    console.error(`Error parsing email:`, parseError);
                }
            }

            connection.end();
            console.log('IMAP connection closed');
            return emails;
        } catch (error: any) {
            console.error('Error fetching emails:', error.message || error);
            if (error.source) {
                console.error('Error source:', error.source);
            }
            return [];
        }
    }
}
