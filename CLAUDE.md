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
TWILIO_PHONE_NUMBER=        # +1... format — used for SMS
TWILIO_WHATSAPP_NUMBER=     # +1... format — Twilio WhatsApp sender (sandbox or approved number)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=        # Verified sender address
YOUTUBE_API_KEY=            # YouTube Data API v3 — bulk channel import (server-side only)
```

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `clients` | Agency clients (ecommerce stores). Fields: `id, name, business_type, niche, tier, status, health_score, from_email, from_name, klaviyo_api_key, meta_access_token, meta_ad_account_id, canva_brand_kit_id, stripe_customer_id` |
| `client_users` | Login credentials for client portal. Fields: `id, name, email, password, client_id, last_login` |
| `contacts` | CRM contacts. Fields: `id, first_name, last_name, email, phone, source, channel, pipeline_stage, client_id, shopify_customer_id, last_activity, status` |
| `pipeline_deals` | Sales pipeline deals. Fields: `id, value, stage, client_id` |
| `workflows` | Sequence definitions. Fields: `id, name, client_id, trigger_type, status, enrolled_count` |
| `workflow_steps` | Steps in a workflow. Fields: `id, workflow_id, step_order, step_type (email/sms/whatsapp/wait), content, subject, wait_hours` |
| `workflow_enrollments` | Contact enrollment in a workflow. Fields: `id, workflow_id, contact_id, client_id, status (active/paused/completed/cancelled), current_step, enrolled_at, next_step_at, completed_at` |
| `messages` | Unified inbox messages. Fields: `id, client_id, contact_id, channel, direction (inbound/outbound), sender_name, sender_phone, content, status (unread/read/sent)` |
| `approvals` | Content pending owner approval. Fields: `id, status (pending/approved/rejected), client_id, created_at` |
| `knowledge_base` | RAG documents. Fields: `id, title, content, type, source, client_id, status, notes (AI member assignment), embedding (vector), created_at` |
| `shopify_connections` | OAuth tokens per shop. Fields: `id, shop, access_token, client_id, scope, created_at` |
| `activity` | Contact activity log. Fields: `id, contact_id, client_id, type, description, created_at` |
| `client_onboarding` | Client questionnaire answers. Fields: `id, client_id, store_url, monthly_revenue, average_order_value, main_products, brand_voice, target_customer, biggest_challenge, current_tools (array), main_competitors, goals, created_at, completed_at`. One row per client (`onConflict: 'client_id'`). |
| `team_briefings` | AI team member cross-briefings. Fields: `id, from_member, to_member, subject, content, priority (normal/high/urgent/low), status (unread/read), created_at`. |

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
| POST | `/send-whatsapp` | Send WhatsApp message via Twilio (`whatsapp:` prefix) |
| POST | `/send-email` | Send email via SendGrid |
| POST | `/generate-embedding` | Embed a knowledge_base document by ID |
| POST | `/search-knowledge` | Semantic search the knowledge base |
| GET  | `/voice-agent/voices` | Fetch ElevenLabs voice list |
| POST | `/voice-agent/save-agent` | Create or update an ElevenLabs conversational agent |
| POST | `/voice-agent/outbound-call` | Initiate outbound call via ElevenLabs + Twilio |
| POST | `/execute-step` | Execute one workflow step (sms or email) |
| POST | `/enroll-contact` | Enroll a contact in a workflow and fire first step |
| POST | `/sms/inbound` | Twilio webhook for inbound SMS |
| POST | `/whatsapp/inbound` | Twilio webhook for inbound WhatsApp messages |
| POST | `/email/tracking` | SendGrid event webhook (opens, clicks, bounces, unsubscribes) |
| GET | `/shopify/install` | Initiate Shopify OAuth |
| GET | `/shopify/callback` | Complete Shopify OAuth, save token |
| POST | `/shopify/sync-customers` | Pull customers from Shopify → contacts table |
| POST | `/shopify/store-data` | Fetch live data from a client's connected Shopify store — total orders, month revenue, month order count, abandoned checkouts count, top 8 products by revenue, 10 most recent orders. Uses stored access token from `shopify_connections`. |
| GET  | `/analytics/stats` | Month-specific platform stats — emails/SMS/WhatsApp sent, contacts added, workflow enrollments, active sequences. Uses Supabase `count: 'exact'` queries with `monthStart` filter. Also returns all-time totals for contacts, active enrollments, pipeline value. |
| POST | `/canva/create-design` | Generate a Canva design brief via Mahdi. Accepts `{ client_id, design_type (social_post/email_header/ad_banner), brand_colors[], prompt }`. Looks up `canva_brand_kit_id` from clients table. Uses `aiCall()` with Mahdi's persona to produce a structured 7-section brief (concept, layout, color usage, typography, copy, imagery, mood). Returns `{ brief, canva_url, design_type, design_label, canva_brand_kit_id }`. Canva URL maps to the matching template browse page. |
| POST | `/stripe/create-subscription` | Create a Stripe customer (if not exists) and subscription for a client. Accepts `{ client_id, price_id, payment_method_id }`. Creates Stripe customer, attaches payment method, sets it as default, creates subscription. Stores `stripe_customer_id` in clients table. Returns `{ ok, subscription_id, customer_id, status }`. Requires `STRIPE_SECRET_KEY` env var. |
| GET  | `/stripe/billing` | Fetch all clients with their Stripe billing status. Returns `{ clients[] }` — each with `id, name, tier, status, stripe_customer_id, subscription_status, subscription_id, current_period_end`. For clients with `stripe_customer_id`, queries Stripe subscriptions API in parallel. |
| POST | `/higgsfield/create-video` | Generate a Higgsfield.ai video production brief via Mahdi. Accepts `{ client_id, video_type (product_showcase/ad_creative/brand_story), prompt }`. Looks up client name, runs `ragSearch` + `getBriefingsContext` in parallel. Uses `aiCall()` with Mahdi's persona to produce a 7-section brief (Concept, Scene Breakdown, Visual Style, Motion Direction, Text Overlays, Audio Mood, CTA). Returns `{ brief, higgsfield_url, video_type, video_label, specs }`. |
| POST | `/whisper/transcribe` | Transcribe an audio file using OpenAI Whisper. Accepts `{ audio_base64, filename, mime_type }`. Converts base64 to Buffer, sends as multipart/form-data to `https://api.openai.com/v1/audio/transcriptions` with `model: whisper-1`. Returns `{ text }`. Max 25 MB. Uses `form-data` npm package for multipart construction. |
| POST | `/competitor/analyze` | Competitor intelligence via Hussain. Accepts `{ facebook_page_url, client_id? }`. Runs RAG search for context, then calls `aiCall()` with Hussain's persona to produce a structured report: positioning, target audience, price tier, marketing channels, weaknesses, and Sales Scales winning angles. Returns `{ analysis }`. |
| POST | `/meta/ad-stats` | Fetch Meta Ads performance for a client. Accepts `{ client_id }` — looks up `meta_access_token` and `meta_ad_account_id` from clients table. 2 parallel Meta Graph API v21.0 calls: account-level insights (spend, impressions, clicks, CTR, purchase ROAS) and top-5 ads by spend at ad level. Returns `{ spend, impressions, clicks, ctr, roas, topAds[] }`. 400 if credentials not configured; 401 on invalid token (error code 190/102). |
| POST | `/klaviyo/stats` | Fetch Klaviyo email performance for a client. Accepts `{ client_id, api_key? }` — looks up `klaviyo_api_key` from clients table if `api_key` not provided. 3 parallel calls: campaigns list, lists (with profile_count), and 30-day aggregate report. Returns `{ openRate, clickRate, revenue, totalLists, totalSubscribers, lists, recentCampaigns }`. Auth: `Klaviyo-API-Key {key}` header, revision `2024-10-15`. 401/403 returns `{ error: 'Invalid Klaviyo API key' }`. |
| GET  | `/revenue/stats` | Revenue stats — pipeline deals, enrollment conversion rates, per-client and per-channel breakdowns |
| GET  | `/revenue/dashboard` | Full revenue dashboard data — same aggregation as `/revenue/stats` but with human-readable trigger labels (Cart Recovery, Post Purchase, Win-Back, Welcome). Returns `{ thisMonth, byChannel, byTrigger, topSequences, byClient, maxRevenue }`. Used by `RevenueDashboard.js`. |
| POST | `/team/brief` | Create a team briefing from one AI member to another — inserts into `team_briefings` |
| GET  | `/team/briefings` | Fetch all briefings; filter by `?recipient=` or `?sender=` query params |
| POST | `/test/trigger-webhook` | Simulate a Shopify abandoned cart webhook for a given `email`, `client_id`, and `first_name`. Runs the full flow end-to-end: verify client → find/create contact → find active cart_abandoned workflow → enroll contact → fire first step. Returns `{ ok, log[], contact_id, enrollment_id, workflow }` with a step-by-step log of every action taken. |

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

`node-cron` runs every 15 minutes. Finds `workflow_enrollments` with `status = 'active'` and `next_step_at <= now`. Processes `wait`, `sms`, `whatsapp`, and `email` step types. Pauses enrollment on inbound SMS or WhatsApp reply. Completes enrollment when all steps are done.

## All Pages (46 total)

### Authentication
- **Login** (`Login.js`) — owner hardcoded credentials, client login via `client_users` table
- **ClientDashboard** (`ClientDashboard.js`) — restricted view for clients (role = 'client')

### MAIN Group
- **Dashboard** (`Dashboard.js`) — owner overview, stats from all tables
- **Clients** (`Clients.js`) — agency client management
- **Contacts** (`Contacts.js`) — CRM contacts, pipeline stages
- **Analytics** (`Analytics.js`) — platform analytics. Calls `GET /analytics/stats` for 6 this-month metrics (emails sent, SMS sent, WhatsApp sent, contacts added, workflow enrollments, active sequences), plus direct Supabase queries for all-time breakdowns, charts by source/stage/channel, and workflow performance table. Client filter dropdown applies to all-time sections.

### AI TEAM Group
- **Hussain** (`Hussain.js`) — chat interface for Intelligence & Strategy AI
- **Hassan** (`Hassan.js`) — chat interface for Growth & Outreach AI
- **Ali** (`Ali.js`) — chat interface for Sales Closer AI
- **Mahdi** (`Mahdi.js`) — chat interface for Marketing & Content AI
- **Fatima** (`Fatima.js`) — chat interface for Operations Manager AI
- **Zainab** (`Zainab.js`) — chat interface for Client Partner AI
- **TeamBriefings** (`TeamBriefings.js`) — create and view briefings between AI team members; briefings are injected into each member's context on every chat request

### CLIENT MGMT Group
- **Approvals** (`Approvals.js`) — content approval queue
- **Sequences** (`Sequences.js`) — workflow/sequence builder; step types: email, sms, whatsapp, wait, tag, pipeline, notify
- **Pipeline** (`Pipeline.js`) — deals pipeline view
- **Inbox** (`Inbox.js`) — unified inbox with channel filter tabs: All, Email, SMS, WhatsApp, Instagram, Facebook; AI reply generation
- **KnowledgeBase** (`KnowledgeBase.js`) — RAG document manager, PDF upload, YouTube bulk channel import (SSE progress), semantic search

### INTEGRATIONS Group
- **Shopify** (`Shopify.js`) — connect stores via OAuth, sync customers
- **ShopifyData** (`ShopifyData.js`) — live store data dashboard at route `shopify-data`. Client selector → fetches `/shopify/store-data` → shows 4 stat cards (monthly revenue, total orders, month orders, abandoned checkouts), recent orders table, top products by revenue with progress bars, and an Ask Hussain AI panel that has real store data in context.
- **SocialMedia** (`SocialMedia.js`) — social media management
- **VoiceAgents** (`VoiceAgents.js`) — ElevenLabs voice agent config; inbound + outbound agents, test call panel. Error details from API are always coerced to string via `errStr()` helper before rendering.
- **KlaviyoStats** (`KlaviyoStats.js`) — Klaviyo email performance dashboard at route `klaviyo-stats`. Client selector → POST `/klaviyo/stats` → shows 4 stat cards (open rate, click rate, revenue attributed, total subscribers), list breakdown bar chart, recent campaigns table, and industry benchmark comparison panel with visual gauge for open rate and click rate vs industry averages. Auth errors surface a Settings link.
- **CanvaDesign** (`CanvaDesign.js`) — Canva AI design brief generator at route `canva-design` (icon `ti-palette`). Client selector (optional, pulls RAG brand context), design type picker (Social Post 1080×1080 / Email Header 600×200 / Ad Banner 1200×628), brand colors input with live swatch preview, prompt textarea. Calls `POST /canva/create-design` → Mahdi generates a 7-section brief. Output panel shows dark header bar with word count, Copy Brief button, Launch in Canva gold link, full brief in pre-wrap, optional Brand Kit ID callout, and usage tip.
- **MetaAds** (`MetaAds.js`) — Meta Ads performance dashboard at route `meta-ads`. Client selector → POST `/meta/ad-stats` → 4 stat cards (spend, impressions, CTR, ROAS), ROAS vs benchmark bar chart, spend efficiency panel (CPC, CPM, total spend), top-5 ads table with per-ad spend bar, clicks, CTR, and ROAS badge. Three distinct error states: 400 (credentials not configured → Settings link), 401 (invalid token → Settings link), generic.
- **HiggsField** (`HiggsField.js`) — Higgsfield.ai video brief generator at route `higgsfield` (icon `ti-video`). Client selector (optional, pulls RAG brand context), video type picker (Product Showcase 15–30s / Ad Creative 6–15s / Brand Story 30–60s) with duration and style sub-labels, prompt textarea. Calls `POST /higgsfield/create-video` → Mahdi generates a 7-section video production brief (Concept, Scene Breakdown, Visual Style, Motion Direction, Text Overlays, Audio Mood, CTA). Output panel shows dark header bar with word count, specs, Copy Brief button, Launch in Higgsfield gold link, full brief in pre-wrap, and usage tip.
- **Integrations** (`Integrations.js`) — all third-party integrations hub

### SALES SCALES Group
- **MyPipeline** (`MyPipeline.js`) — internal Sales Scales deals pipeline
- **SocialAutomation** (`SocialAutomation.js`) — DM / social automation
- **Reports** (`Reports.js`) — reporting and analytics
- **CaseStudies** (`CaseStudies.js`) — case study library
- **RevenueDashboard** (`RevenueDashboard.js`) — revenue stats: by channel (Email/SMS/WhatsApp/Voice with proportional revenue attribution), by sequence type (Cart Recovery/Post Purchase/Win-Back/Welcome with completion rates), top sequences table ranked by conversion rate, per-client breakdown with pipeline bars. Calls `GET /revenue/dashboard`. Nav icon: `ti-currency-dollar`.
- **AuditTool** (`AuditTool.js`) — full AI-powered store audit at route `store-audit`. Sends a structured JSON prompt to `/hussain`, parses the response (strips markdown fences, brace-padding recovery, safe defaults), and displays a scored report across 5 categories (email/cart abandonment/SMS/social/ads, each /20, total /100 with letter grade). Includes animated loading steps, localStorage audit history (last 5), and copy-to-clipboard pitch with execCommand fallback.

### PLATFORM Group
- **Billing** (`Billing.js`) — Stripe billing dashboard at route `billing` (icon `ti-credit-card`). Loads all clients via `GET /stripe/billing`. Shows 4 stat cards (MRR, total clients, active subscriptions, overdue count). Table shows each client's tier, monthly fee (mapped from tier: Starter $997/Growth $1997/Scale $3997/Enterprise custom), Stripe subscription status badge, and Stripe Customer ID. "Setup" button opens modal to enter `price_id` + `payment_method_id` → calls `POST /stripe/create-subscription`. "Stripe" link opens client in Stripe dashboard for already-linked clients.
- **Transcribe** (`Transcribe.js`) — Sales call transcription tool at route `transcribe` (icon `ti-microphone-2`). Drag-and-drop or click-to-browse audio file upload (MP3, WAV, M4A, OGG, FLAC, max 25 MB). Reads file as base64 via FileReader, POSTs to `/whisper/transcribe`, displays full transcript with word count and copy button. Gold tip box guides user to add transcript to Knowledge Base → Ali.
- **Onboarding** (`Onboarding.js`) — admin view of all `client_onboarding` responses (expandable rows, stats)
- **Marketplace** (`Marketplace.js`) — service/tool marketplace
- **WhiteLabel** (`WhiteLabel.js`) — white-label configuration
- **Settings** (`Settings.js`) — platform settings

### Authentication / Onboarding Flow
- **ClientOnboardingFlow** (`ClientOnboardingFlow.js`) — full-screen 4-step questionnaire shown to clients on first login before the dashboard. Stores answers in `client_onboarding` table. Shown when `client_onboarding.completed_at` is null.

Also imported but routed via `case "ai"`: **AIEngine** (`AIEngine.js`) — legacy Zainab AI Engine page.

## Navigation Structure

Sidebar is defined inline in `App.js` as the `navItems` array, grouped into: MAIN, AI TEAM, CLIENT MGMT, INTEGRATIONS, SALES SCALES, PLATFORM.

Current SALES SCALES nav items: My Pipeline (`mypipeline`), Social Automation (`socialautomation`), Reports (`reports`), Case Studies (`casestudies`), Revenue Dashboard (`revenue-dashboard`), Store Audit (`store-audit`).

The old `audit` route (MAIN group) has been removed — `store-audit` is the only audit entry point.

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

**AI JSON parsing from team endpoints**: When asking an AI team endpoint (e.g. `/hussain`) to return JSON, strip markdown code fences before parsing: `result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()`. Extract the JSON object with `/\{[\s\S]*\}/`. If `JSON.parse` fails, attempt brace-padding recovery (count `{` vs `}`, append missing `}`). Always fill missing fields with safe defaults rather than throwing.

**Clipboard copy pattern**: Try `navigator.clipboard.writeText(text).then(...).catch(...)` first. Fallback: create a `<textarea>`, append to body off-screen, select, `document.execCommand('copy')`, then remove.

**WhatsApp via Twilio**: Always prefix both `from` and `to` with `whatsapp:` — e.g. `from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + phone`. The inbound webhook strips the prefix with `.replace('whatsapp:', '')` before looking up the contact by phone.

**Shopify live context injection**: `getShopifyContext(clientId)` runs in `Promise.all` alongside `ragSearch` and `getBriefingsContext` in every AI team endpoint. Fetches live orders, revenue, and abandoned checkouts from the client's connected Shopify store. Returns `''` gracefully if no store is connected.

**Team briefings context injection**: `getBriefingsContext(memberName)` runs in `Promise.all` alongside `ragSearch` in every AI team endpoint. The two strings are joined with `'\n\n'` and filtered for empty values before being passed as context.

**Client onboarding gate**: `App.js` checks `client_onboarding.completed_at` for client-role users before rendering. `null` = loading, `false` = show `ClientOnboardingFlow`, `true` = show `ClientDashboard`.

**Per-client email sender**: `getClientSender(clientId)` helper in server.js queries `clients.from_email` and `clients.from_name`. Falls back to `SENDGRID_FROM_EMAIL` env var if the client has none configured. Called at all 5 email-sending spots: `enrollContactInWorkflow` helper, scheduler cron, `/send-email`, `/execute-step`, and `/enroll-contact` endpoint. Configured per client in Settings → Email Domains tab.

**Models in use**:
- `claude-sonnet-4-6` — all 6 AI team member endpoints (via `aiCall` helper)
- `claude-haiku-4-5-20251001` — audit (legacy `/audit` endpoint), generate-reply, generate-embedding (utility, fast/cheap)
- `text-embedding-3-small` — all embeddings (OpenAI)
