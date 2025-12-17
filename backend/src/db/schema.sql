-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing types if they exist (Cascade will handle dependent tables)
DROP TYPE IF EXISTS email_status CASCADE;
DROP TYPE IF EXISTS email_priority CASCADE;
DROP TYPE IF EXISTS doc_type CASCADE;

-- Create ENUM types
CREATE TYPE email_status AS ENUM ('pending', 'needs_review', 'human_answered', 'rag_answered', 'fallback_sent', 'archived');
CREATE TYPE email_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE doc_type AS ENUM ('general', 'faq', 'policy', 'procedure');

-- Drop existing tables to ensure clean state (Cascade to handle foreign keys)
DROP TABLE IF EXISTS kb_documents CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Departments Table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  code character varying NOT NULL UNIQUE,
  description text,
  head_name character varying NOT NULL,
  head_email character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

-- Users Table
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  name character varying,
  role character varying DEFAULT 'employee'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);

-- Emails Table
CREATE TABLE public.emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_email character varying NOT NULL,
  subject character varying,
  body_text text,
  status email_status DEFAULT 'pending'::email_status,
  classified_dept_id uuid,
  confidence_score numeric,
  generated_reply text,
  cc_email_sent_to character varying,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  priority email_priority DEFAULT 'medium'::email_priority,
  rag_meta jsonb,
  CONSTRAINT emails_pkey PRIMARY KEY (id),
  CONSTRAINT emails_classified_dept_id_fkey FOREIGN KEY (classified_dept_id) REFERENCES public.departments(id)
);

-- Knowledge Base Documents Table
CREATE TABLE public.kb_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid,
  content text NOT NULL,
  doc_type doc_type DEFAULT 'general'::doc_type,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kb_documents_pkey PRIMARY KEY (id),
  CONSTRAINT kb_documents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
