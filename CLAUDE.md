# Sales Scales v2 — Claude Code Context

## What This Is

Sales Scales is an AI-powered revenue system for ecommerce agencies. It has two user roles:
- **Owner** (Yousef) — full access to all pages via a hardcoded login
- **Client** — limited portal view via `ClientDashboard`, authenticated through the `client_users` Supabase table

## Running the Project

Two processes must run simultaneously:

| Process | Command | Port |
|---------|---------|------|
| React frontend | `npm start` | 3000 |
| Express backend | `node server.js` | 3001 |

There is no `concurrently` setup — open two terminals.

## Tech Stack

- **Frontend**: React 19, React Router DOM 7, no state management library
- **Backend**: Express 5, Node.js
- **Database**: Supabase (Postgres) via `@supabase/supabase-js`
- **AI**: Anthropic Claude API (`claude-sonnet-4-6` for AI team, `claude-haiku-4-5-20251001` for utility endpoints)
- **Embeddings / RAG**: OpenAI `text-embedding-3-small`
- **Voice**: ElevenLabs Conversational AI (Phase 6) — agents created via `/v1/convai/agents`, outbound calls via Twilio integration
- **SMS**: Twilio
- **Email**: SendGrid
- **PDF parsing**: pdf2json (server-side, streams buffer — never pdf-parse for large files)
- **Scheduling**: node-cron (runs every 15 minutes checking `workflow_enrollments`)
- **Icons**: Tabler Icons via CDN (`ti ti-*` classes)
- **Fonts**: DM Sans (body), DM Mono (labels/mono elements) — loaded from Google Fonts in `global.css`

## Design System

All design tokens are CSS variables defined in `src/styles/global.css`:

```
--navy:       #0a1628   ← primary background, sidebar, table headers
--navy-mid:   #112240
--navy-light: #1a3050
--gold:       #c9a84c   ← accent, active nav, CTAs
--blue:       #3b82f6
--green:      #10b981
--bg:         #f0f3f8   ← page background
--surface:    #ffffff   ← cards, panels
--border:     #e4e9f0
--text:       #0a1628
--muted:      #8896a8
--slate:      #4a5568
--red:        #dc2626
--yellow:     #d97706
```

### Reusable CSS Classes (always use these, never write inline equivalents)

**Layout**: `.card`, `.stat-card`, `.stats-row` (4-col grid), `.table-wrap`, `.table-header`, `.table-row`, `.th`, `.td`

**Buttons**: `.btn .btn-navy`, `.btn .btn-gold`, `.btn .btn-outline`, `.btn .btn-outline-gold`, `.btn .btn-red`

**Badges**: `.badge-green`, `.badge-gold`, `.badge-blue`, `.badge-yellow`, `.badge-red`

**Stat cards**: `.stat-label`, `.stat-value`, `.stat-sub-gold`, `.stat-sub-blue`, `.stat-sub-green`, `.stat-sub`

**Accents**: `.stat-card.gold-top`, `.stat-card.blue-top`, `.stat-card.green-top`, `.stat-card.navy-top`

**Opportunity box**: `.opp-box`, `.opp-head`, `.opp-dot`, `.opp-title`, `.opp-text`

**Progress bars**: `.pbar` + `.pfill` / `.pfill-blue` / `.pfill-green`

**Section labels**: `.section-label` (9px, uppercase, DM Mono, spaced)

## Environment Variables

All in `.env` at project root. Server reads them with `dotenv`. React reads `REACT_APP_*` keys at build time.

```
ANTHROPIC_API_KEY=          # Claude API — used server-side only
REACT_APP_SUPABASE_URL=     # Supabase project URL
REACT_APP_SUPABASE_ANON_KEY=# Supabase anon key — used by both client and server
ELEVENLABS_API_KEY=         # ElevenLabs API key — voice agent creation and outbound calls
ELEVENLABS_PHONE_NUMBER_ID= # ElevenLabs phone number ID — required for outbound call initiation
OPENAI_API_KEY=             # Embeddings (text-embedding-3-small) — server-side only
SHOPIFY_CLIENT_ID=          # Shopify OAuth app
SHOPIFY_CLIENT_SECRET=
SHOPIFY_REDIRECT_URI=       # ngrok or prod URL for /shopify/callback
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=        # +1... format
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=        # Verified sender address
YOUTUBE_API_KEY=            # YouTube Data API v3 — bulk channel import (server-side only)
```

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `clients` | Agency clients (ecommerce stores). Fields: `id, name, business_type, niche, tier, status, health_score` |
| `client_users` | Login credentials for client portal. Fields: `id, name, email, password, client_id, last_login` |
| `contacts` | CRM contacts. Fields: `id, first_name, last_name, email, phone, source, channel, pipeline_stage, client_id, shopify_customer_id, last_activity, status` |
| `pipeline_deals` | Sales pipeline deals. Fields: `id, value, stage, client_id` |
| `workflows` | Sequence definitions. Fields: `id, name, client_id, trigger_type, status, enrolled_count` |
| `workflow_steps` | Steps in a workflow. Fields: `id, workflow_id, step_order, step_type (email/sms/wait), content, subject, wait_hours` |
| `workflow_enrollments` | Contact enrollment in a workflow. Fields: `id, workflow_id, contact_id, client_id, status (active/paused/completed/cancelled), current_step, enrolled_at, next_step_at, completed_at` |
| `messages` | Unified inbox messages. Fields: `id, client_id, contact_id, channel, direction (inbound/outbound), sender_name, sender_phone, content, status (unread/read/sent)` |
| `approvals` | Content pending owner approval. Fields: `id, status (pending/approved/rejected), client_id, created_at` |
| `knowledge_base` | RAG documents. Fields: `id, title, content, type, source, client_id, status, notes (AI member assignment), embedding (vector), created_at` |
| `shopify_connections` | OAuth tokens per shop. Fields: `id, shop, access_token, client_id, scope, created_at` |
| `activity` | Contact activity log. Fields: `id, contact_id, client_id, type, description, created_at` |

### Supabase RPC Functions

`search_knowledge_base(query_embedding, client_id_filter, match_count)` — vector similarity search used by RAG.

## Server Architecture (`server.js`)

Single Express file, port 3001. All AI calls go through the `aiCall()` helper which hits the Anthropic API directly via axios. All RAG searches go through `ragSearch()` which embeds the query with OpenAI then calls `search_knowledge_base` RPC.

### Utility Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/audit` | Shopify store audit — returns structured JSON via Claude Haiku |
| POST | `/generate-reply` | AI-suggested inbox reply via Claude Haiku |
| POST | `/upload-pdf` | PDF → chunks → embeddings → knowledge_base (background after response) |
| POST | `/youtube-transcript` | Fetch YouTube transcript text |
| POST | `/send-sms` | Send SMS via Twilio |
| POST | `/send-email` | Send email via SendGrid |
| POST | `/generate-embedding` | Embed a knowledge_base document by ID |
| POST | `/search-knowledge` | Semantic search the knowledge base |
| GET  | `/voice-agent/voices` | Fetch ElevenLabs voice list |
| POST | `/voice-agent/save-agent` | Create or update an ElevenLabs conversational agent |
| POST | `/voice-agent/outbound-call` | Initiate outbound call via ElevenLabs + Twilio |
| POST | `/execute-step` | Execute one workflow step (sms or email) |
| POST | `/enroll-contact` | Enroll a contact in a workflow and fire first step |
| POST | `/sms/inbound` | Twilio webhook for inbound SMS |
| POST | `/email/tracking` | SendGrid event webhook (opens, clicks, bounces, unsubscribes) |
| GET | `/shopify/install` | Initiate Shopify OAuth |
| GET | `/shopify/callback` | Complete Shopify OAuth, save token |
| POST | `/shopify/sync-customers` | Pull customers from Shopify → contacts table |

### AI Team Endpoints (6 members, all identical pattern)

Each member uses `ragSearch()` to fetch relevant context then passes it to `aiCall()` with a fixed persona prompt. They never break character or mention Claude.

| Endpoint | Name | Role |
|----------|------|------|
| POST `/hussain` | Hussain | Intelligence & Strategy — data-driven, founder mindset |
| POST `/hassan` | Hassan | Growth & Outreach — prospecting, personalized communication |
| POST `/ali` | Ali | Sales Closer — NEPQ framework, high-ticket closing |
| POST `/mahdi` | Mahdi | Marketing & Content — copywriting, email sequences, SMS |
| POST `/fatima` | Fatima | Operations Manager — systematic, tracking, reports |
| POST `/zainab` | Zainab | Client Partner — relationship management, onboarding |

All AI team endpoints accept `{ prompt, clientId }` and return `{ result }`.

### Scheduler

`node-cron` runs every 15 minutes. Finds `workflow_enrollments` with `status = 'active'` and `next_step_at <= now`. Processes `wait`, `sms`, and `email` step types. Pauses enrollment on inbound SMS reply. Completes enrollment when all steps are done.

## All Pages (37 total)

### Authentication
- **Login** (`Login.js`) — owner hardcoded credentials, client login via `client_users` table
- **ClientDashboard** (`ClientDashboard.js`) — restricted view for clients (role = 'client')

### MAIN Group
- **Dashboard** (`Dashboard.js`) — owner overview, stats from all tables
- **Clients** (`Clients.js`) — agency client management
- **Contacts** (`Contacts.js`) — CRM contacts, pipeline stages
- **AuditTool** (`AuditTool.js`) — enter a Shopify URL, AI audits the store, returns score + pitch
- **Analytics** (`Analytics.js`) — platform analytics

### AI TEAM Group
- **Hussain** (`Hussain.js`) — chat interface for Intelligence & Strategy AI
- **Hassan** (`Hassan.js`) — chat interface for Growth & Outreach AI
- **Ali** (`Ali.js`) — chat interface for Sales Closer AI
- **Mahdi** (`Mahdi.js`) — chat interface for Marketing & Content AI
- **Fatima** (`Fatima.js`) — chat interface for Operations Manager AI
- **Zainab** (`Zainab.js`) — chat interface for Client Partner AI

### CLIENT MGMT Group
- **Approvals** (`Approvals.js`) — content approval queue
- **Sequences** (`Sequences.js`) — workflow/sequence builder with step editor
- **Pipeline** (`Pipeline.js`) — deals pipeline view
- **Inbox** (`Inbox.js`) — unified inbox (SMS + email), AI reply generation
- **KnowledgeBase** (`KnowledgeBase.js`) — RAG document manager, PDF upload, YouTube import, semantic search

### INTEGRATIONS Group
- **Shopify** (`Shopify.js`) — connect stores via OAuth, sync customers
- **SocialMedia** (`SocialMedia.js`) — social media management
- **VoiceAgents** (`VoiceAgents.js`) — AI voice agent configuration
- **Integrations** (`Integrations.js`) — all third-party integrations hub

### SALES SCALES Group
- **MyPipeline** (`MyPipeline.js`) — internal Sales Scales deals pipeline
- **SocialAutomation** (`SocialAutomation.js`) — DM / social automation
- **Reports** (`Reports.js`) — reporting and analytics
- **CaseStudies** (`CaseStudies.js`) — case study library

### PLATFORM Group
- **Onboarding** (`Onboarding.js`) — client onboarding flows
- **Marketplace** (`Marketplace.js`) — service/tool marketplace
- **WhiteLabel** (`WhiteLabel.js`) — white-label configuration
- **Settings** (`Settings.js`) — platform settings

Also imported but routed via `case "ai"`: **AIEngine** (`AIEngine.js`) — legacy Zainab AI Engine page.

## Navigation Structure

Sidebar is defined inline in `App.js` as the `navItems` array, grouped into: MAIN, AI TEAM, CLIENT MGMT, INTEGRATIONS, SALES SCALES, PLATFORM.

State management is `useState` in `App.js` — `currentPage` string drives which component renders. No React Router `<Route>` — single-page switch statement in `renderPage()`.

Auth state stored in `localStorage` as `"user"` key containing `{ name, email, role, clientId?, clientName?, tier? }`.

## Coding Patterns

**Page components**: functional components, local `useState` + `useEffect`, direct `supabase` calls. No custom hooks — keep data fetching in the page file.

**Styling**: use CSS classes from `global.css` for layout, cards, tables, buttons, badges. Inline styles only for one-off positioning or dynamic values (widths, colors from data).

**API calls from frontend**: `axios.post('http://localhost:3001/endpoint', payload)` — always localhost:3001.

**Server AI calls**: always `axios.post` directly to `https://api.anthropic.com/v1/messages`, never the Anthropic SDK.

**PDF chunking**: chunk size 1000 chars, 100 char overlap. Response sent immediately with chunk count; embedding happens in background loop with 150ms delay between chunks to avoid rate limits.

**Supabase upserts**: use `onConflict` param — e.g. `{ onConflict: 'shop' }` for shopify_connections, `{ onConflict: 'shopify_customer_id' }` for contacts from Shopify sync.

**Template variables**: workflow content uses `{{first_name}}` replaced with `.replace('{{first_name}}', contact.first_name || 'there')`.

**No TypeScript** — plain JavaScript throughout.

**No React Router** — navigation is a `currentPage` string + switch statement in App.js.

**Models in use**:
- `claude-sonnet-4-6` — all 6 AI team member endpoints (via `aiCall` helper)
- `claude-haiku-4-5-20251001` — audit, generate-reply, generate-embedding (utility, fast/cheap)
- `text-embedding-3-small` — all embeddings (OpenAI)
