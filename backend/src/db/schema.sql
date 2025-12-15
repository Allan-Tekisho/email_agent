-- Keep existing tables
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Add new columns if they don't exist (Idempotent approach)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'head_email') THEN
        ALTER TABLE departments ADD COLUMN head_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'head_name') THEN
        ALTER TABLE departments ADD COLUMN head_name VARCHAR(255);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    msg_id VARCHAR(255) UNIQUE NOT NULL,
    subject TEXT,
    body TEXT,
    from_email VARCHAR(255),
    dept_id INTEGER REFERENCES departments(id),
    priority VARCHAR(10) CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'REVIEW_QUEUE', 'SKIPPED')),
    confidence FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_logs (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES emails(id),
    docs_used JSONB,
    generated_reply TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- New Table for Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_docs (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    content_summary TEXT,
    dept_id INTEGER REFERENCES departments(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update default departments with dummy heads
INSERT INTO departments (name, head_email, head_name) VALUES 
('Sales', 'sales.head@example.com', 'Alice Sales'), 
('Support', 'support.head@example.com', 'Bob Support'), 
('HR', 'hr.head@example.com', 'Charlie HR'), 
('Finance', 'finance.head@example.com', 'David Finance'), 
('Operations', 'ops.head@example.com', 'Eve Ops'), 
('Other', 'admin@example.com', 'General Admin')
ON CONFLICT (name) DO UPDATE SET head_email = EXCLUDED.head_email;
