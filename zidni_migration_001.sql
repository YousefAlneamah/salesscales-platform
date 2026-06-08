-- Zidni migration 001
-- Run this if you already created the tables from zidni_schema.sql
-- Adds niche, whatsapp, country columns to zidni_clients

ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS niche text;
ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE zidni_clients ADD COLUMN IF NOT EXISTS country text;
