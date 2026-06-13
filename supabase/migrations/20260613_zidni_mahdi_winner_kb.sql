CREATE TABLE IF NOT EXISTS zidni_mahdi_winner_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL UNIQUE,
  community_facebook text,
  community_reddit text,
  community_youtube text,
  community_language text,
  community_pain_phrases text,
  emotional_pain_fear integer,
  emotional_pain_stress integer,
  emotional_pain_urgency integer,
  emotional_pain_financial integer,
  emotional_pain_identity integer,
  transformation_statement text,
  keyword_primary text,
  keyword_secondary text,
  competition_gap text,
  pricing_sweet_spot text,
  seasonal_timing text,
  series_strategy text,
  scale_methods text,
  forbidden_concepts text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zidni_mahdi_winner_kb DISABLE ROW LEVEL SECURITY;
