-- Zidni database schema
-- Run this in the Supabase SQL editor

CREATE TABLE zidni_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  tier text DEFAULT 'starter',
  status text DEFAULT 'active',
  niche text,
  whatsapp text,
  country text,
  referral_code text,
  referred_by uuid,
  payout_email text,
  payout_method text DEFAULT 'paypal',
  verified boolean DEFAULT false,
  accepted_terms boolean DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  name text NOT NULL,
  max_spots integer DEFAULT 100,
  current_spots integer DEFAULT 0,
  status text DEFAULT 'building',
  monthly_revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_pool_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES zidni_pools(id),
  month text NOT NULL,
  etsy numeric DEFAULT 0,
  gumroad numeric DEFAULT 0,
  kdp numeric DEFAULT 0,
  pinterest numeric DEFAULT 0,
  affiliate numeric DEFAULT 0,
  shopify numeric DEFAULT 0,
  redbubble numeric DEFAULT 0,
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_client_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES zidni_clients(id),
  pool_id uuid REFERENCES zidni_pools(id),
  spots numeric DEFAULT 1,
  multiplier numeric DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES zidni_clients(id),
  month text NOT NULL,
  pool_share numeric DEFAULT 0,
  personal_etsy numeric DEFAULT 0,
  personal_gumroad numeric DEFAULT 0,
  personal_kdp numeric DEFAULT 0,
  personal_affiliate numeric DEFAULT 0,
  personal_shopify numeric DEFAULT 0,
  personal_redbubble numeric DEFAULT 0,
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES zidni_clients(id),
  amount numeric NOT NULL,
  month text NOT NULL,
  status text DEFAULT 'pending',
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES zidni_clients(id),
  title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_personal_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES zidni_clients(id),
  platform text NOT NULL,
  url text,
  status text DEFAULT 'active',
  monthly_revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE zidni_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL,
  whatsapp text,
  niche text,
  country text,
  created_at timestamptz DEFAULT now()
);
