-- Zidni migration 001
-- Run this if you already created the tables from zidni_schema.sql

-- Adds niche, whatsapp, country to zidni_clients
ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS niche text;
ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS country text;

-- Unique constraints required for upsert operations
ALTER TABLE zidni_pool_revenue ADD CONSTRAINT IF NOT EXISTS zidni_pool_revenue_pool_month_key UNIQUE (pool_id, month);
ALTER TABLE zidni_earnings     ADD CONSTRAINT IF NOT EXISTS zidni_earnings_client_month_key   UNIQUE (client_id, month);
