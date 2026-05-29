-- ============================================================
-- Sales Scales v2 — Row Level Security
-- ============================================================
-- Enables RLS on all client-scoped tables and restricts access
-- so an authenticated user can only read/write rows whose
-- client_id matches their JWT claim.
--
-- Assumptions / how this maps to the app:
--   * The Express server uses the Supabase SERVICE ROLE key for
--     all writes. The service role bypasses RLS automatically, so
--     server-side flows (scheduler, AI endpoints, webhooks) keep
--     working unchanged.
--   * Client portal sessions must carry a JWT with these custom
--     claims for the policies below to grant access:
--         client_id : the client's uuid
--         role      : 'owner' for the agency owner (full access)
--     Set these via a Supabase Auth custom-claims hook, or mint a
--     JWT containing them when a client_user logs in.
--   * The agency owner (role = 'owner') can access every row.
--
-- Helper expressions used in every policy:
--   (auth.jwt() ->> 'role') = 'owner'                          -> owner full access
--   client_id = (auth.jwt() ->> 'client_id')::uuid             -> client-scoped access
-- ============================================================

-- ---------- contacts ----------
alter table contacts enable row level security;
drop policy if exists contacts_client_access on contacts;
create policy contacts_client_access on contacts
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- messages ----------
alter table messages enable row level security;
drop policy if exists messages_client_access on messages;
create policy messages_client_access on messages
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- workflows ----------
alter table workflows enable row level security;
drop policy if exists workflows_client_access on workflows;
create policy workflows_client_access on workflows
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- workflow_enrollments ----------
alter table workflow_enrollments enable row level security;
drop policy if exists workflow_enrollments_client_access on workflow_enrollments;
create policy workflow_enrollments_client_access on workflow_enrollments
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- activity ----------
alter table activity enable row level security;
drop policy if exists activity_client_access on activity;
create policy activity_client_access on activity
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- reports ----------
alter table reports enable row level security;
drop policy if exists reports_client_access on reports;
create policy reports_client_access on reports
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- invoices ----------
alter table invoices enable row level security;
drop policy if exists invoices_client_access on invoices;
create policy invoices_client_access on invoices
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- call_logs ----------
alter table call_logs enable row level security;
drop policy if exists call_logs_client_access on call_logs;
create policy call_logs_client_access on call_logs
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- client_profiles ----------
alter table client_profiles enable row level security;
drop policy if exists client_profiles_client_access on client_profiles;
create policy client_profiles_client_access on client_profiles
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);

-- ---------- approvals ----------
alter table approvals enable row level security;
drop policy if exists approvals_client_access on approvals;
create policy approvals_client_access on approvals
  for all to authenticated
  using      ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check ((auth.jwt() ->> 'role') = 'owner' or client_id = (auth.jwt() ->> 'client_id')::uuid);
