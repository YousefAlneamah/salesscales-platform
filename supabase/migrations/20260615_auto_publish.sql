-- Auto-publish support: store Gumroad references on the content queue
ALTER TABLE zidni_content_queue ADD COLUMN IF NOT EXISTS published_url text;
ALTER TABLE zidni_content_queue ADD COLUMN IF NOT EXISTS gumroad_id text;
