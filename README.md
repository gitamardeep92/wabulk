# WaBulk — WhatsApp Bulk Notification API

Send personalized transactional WhatsApp notifications at scale.
One Render service runs everything. Sessions stored in Supabase — survive redeploys.

---

## Architecture

```
wabulk-api.onrender.com/          → marketing site
wabulk-api.onrender.com/app       → user dashboard  
wabulk-api.onrender.com/admin     → admin panel
wabulk-api.onrender.com/v1/...    → REST API
```

One Node.js server on Render free tier handles everything.
WhatsApp sessions saved in Supabase (not disk) — no persistent disk needed.
UptimeRobot pings every 5 min to keep server awake.

---

## What you need (all free)

| Service       | Purpose                    | Cost |
|---------------|----------------------------|------|
| Render        | Runs the server            | Free |
| Supabase      | Database + session storage | Free |
| Upstash       | Redis for message queue    | Free |
| GitHub        | Code + auto-deploy         | Free |
| UptimeRobot   | Keeps server awake         | Free |

Total: $0/month

---

## Project structure

```
wabulk/
├── backend/               Node.js Express server
│   ├── src/
│   │   ├── index.js       Main server — also serves frontend/admin/marketing
│   │   ├── routes/        auth, sessions, messages, templates, webhooks, admin
│   │   ├── services/
│   │   │   ├── sessionManager.js   WA session lifecycle
│   │   │   ├── supabaseStore.js    Saves WA sessions to Supabase (no disk!)
│   │   │   └── templateEngine.js  {{variable}} interpolation
│   │   ├── workers/
│   │   │   └── messageWorker.js   BullMQ queue processor
│   │   ├── middleware/    auth.js, planLimits.js
│   │   └── lib/           supabase.js, redis.js
│   ├── supabase-schema.sql
│   ├── .env.example
│   ├── railway.json
│   └── render.yaml
├── frontend/              React user dashboard (builds to backend/public/app)
├── admin/                 React admin panel (builds to backend/public/admin)
└── marketing/             Static landing page (copied to backend/public/marketing)
```

---

## Setup

### 1. Supabase (new project)

You already have a Supabase account. Just create a second project:

1. supabase.com → New project → name it `wabulk`
2. SQL Editor → paste `backend/supabase-schema.sql` → Run
3. Then paste and run these 3 functions:

```sql
create or replace function increment_campaign_sent(campaign_id uuid)
returns void language plpgsql as $$
begin
  update campaigns set sent_count = sent_count + 1 where id = campaign_id;
end; $$;

create or replace function increment_campaign_failed(campaign_id uuid)
returns void language plpgsql as $$
begin
  update campaigns set failed_count = failed_count + 1 where id = campaign_id;
end; $$;

create or replace function upsert_usage(p_user_id uuid, p_month text, p_messages int)
returns void language plpgsql as $$
begin
  insert into usage(user_id, month, messages_sent)
  values(p_user_id, p_month, p_messages)
  on conflict(user_id, month)
  do update set messages_sent = usage.messages_sent + p_messages;
end; $$;
```

4. Settings → API → copy Project URL and service_role key

### 2. Upstash Redis

1. upstash.com → sign up with GitHub
2. Create database → choose Asia Pacific (Mumbai) region
3. Copy the Redis URL — it starts with rediss://

### 3. Local development

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL, JWT_SECRET
# Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH (see below)
```

Generate admin password hash:
```bash
node -e "import('bcryptjs').then(m=>m.default.hash('YourPassword123',12).then(console.log))"
```
Paste the output into ADMIN_PASSWORD_HASH in .env

Run locally (3 terminals):
```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2  
cd frontend && npm install && npm run dev
# → http://localhost:3000/app

# Terminal 3
cd admin && npm install && npm run dev
# → http://localhost:3001/admin
```

---

## Deploy to Render

### Step 1 — Push to GitHub

```bash
cd wabulk
git init
git add .
git commit -m "initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOURNAME/wabulk.git
git push -u origin main
```

### Step 2 — Create Render service

1. render.com → New → Web Service
2. Connect GitHub → select your wabulk repo
3. Settings:
   - Name: wabulk-api
   - Region: Singapore
   - Branch: main
   - Root Directory: backend
   - Build Command: npm install && npm run build
   - Start Command: npm start
   - Plan: Free

### Step 3 — Add environment variables

In Render dashboard → your service → Environment:

```
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = your-service-role-key
REDIS_URL             = rediss://default:xxxx@xxxx.upstash.io:6379
JWT_SECRET            = any-long-random-string-minimum-32-chars
NODE_ENV              = production
PORT                  = 10000
ADMIN_EMAIL           = admin@yourdomain.com
ADMIN_PASSWORD_HASH   = $2b$12$xxxx...
ALLOWED_ORIGIN        = https://wabulk-api.onrender.com
```

Note: Set ALLOWED_ORIGIN to whatever URL Render assigns after first deploy.

### Step 4 — Set up UptimeRobot (keeps server awake)

1. uptimerobot.com → free account
2. Add monitor:
   - Monitor type: HTTP(s)
   - URL: https://wabulk-api.onrender.com/health
   - Monitoring interval: every 5 minutes
3. Done — server never sleeps

### Step 5 — Live

```
https://wabulk-api.onrender.com/         marketing page
https://wabulk-api.onrender.com/app      user dashboard
https://wabulk-api.onrender.com/admin    admin panel
```

---

## Why no persistent disk needed

WhatsApp sessions are saved directly to your Supabase database instead of the
server filesystem. This means:

- Render redeploys → sessions survive (loaded from Supabase on startup)
- Server restarts → sessions survive
- Free tier filesystem wipes → sessions survive

The supabaseStore.js service handles all of this automatically. Users scan QR
once and never need to scan again unless they manually disconnect.

---

## Daily workflow

```bash
# Edit any file on your Mac
code backend/src/routes/messages.js

# Push to deploy
git add .
git commit -m "what you changed"
git push
# Render detects push → builds → deploys in ~3 minutes
# WhatsApp sessions are preserved automatically
```

---

## API reference

### Send bulk messages

```bash
curl -X POST https://wabulk-api.onrender.com/v1/messages/send \
  -H "Authorization: Bearer wabk_live_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid-of-your-wa-session",
    "template": "Hi {{name}}, your {{plan}} expires on {{date}}.",
    "messages": [
      { "to": "+919876543210", "vars": { "name": "Rahul", "plan": "Gold", "date": "25 Apr" } },
      { "to": "+918800001234", "vars": { "name": "Priya", "plan": "Silver", "date": "30 Apr" } }
    ],
    "delay_ms": 3000
  }'
```

### Response
```json
{
  "campaign_id": "uuid",
  "queued": 2,
  "message": "2 messages queued successfully"
}
```

---

## Environment variables

| Variable              | Required | Description |
|-----------------------|----------|-------------|
| SUPABASE_URL          | Yes      | Supabase project URL |
| SUPABASE_SERVICE_KEY  | Yes      | Supabase service role key |
| REDIS_URL             | Yes      | Upstash Redis URL (rediss://...) |
| JWT_SECRET            | Yes      | Long random string for JWT |
| ADMIN_EMAIL           | Yes      | Admin login email |
| ADMIN_PASSWORD_HASH   | Yes      | bcrypt hash of admin password |
| NODE_ENV              | No       | production or development |
| PORT                  | No       | 10000 on Render, 4000 locally |
| ALLOWED_ORIGIN        | No       | Your Render URL for CORS |
