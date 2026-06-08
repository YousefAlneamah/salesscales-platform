-- Zidni migration 002 — Knowledge base + content queue tables

CREATE TABLE zidni_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL UNIQUE,
  target_audience text,
  top_products text,
  affiliate_programs text,
  content_hooks text,
  forbidden_phrases text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  stream text NOT NULL,
  title text,
  content jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
