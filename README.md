# WaBulk — WhatsApp Bulk Notification API

Send personalized transactional WhatsApp notifications at scale via a simple REST API.
One server serves everything — API, dashboard, admin panel, and marketing site.

---

## How it works (single service)

```
your-app.up.railway.app/          → marketing site
your-app.up.railway.app/app       → user dashboard
your-app.up.railway.app/admin     → admin panel
your-app.up.railway.app/v1/...    → REST API
```

Everything runs from one Node.js server on Railway.

---

## Project structure

```
wabulk/
├── backend/      Node.js + Express — API + serves all static files
├── frontend/     React dashboard — builds into backend/public/app
├── admin/        React admin panel — builds into backend/public/admin
├── marketing/    Static HTML landing page
└── README.md
```

---

## What you need (all free)

| Service | What for | Cost |
|---------|----------|------|
| Railway (railway.app) | Runs the server | Free (~$0-5/mo) |
| Supabase (supabase.com) | Database | Free (2nd project) |
| Upstash (upstash.com) | Redis for message queue | Free |
| GitHub | Code repo + auto-deploy | Free |

---

## Local development setup

### 1. Set up Supabase

1. Go to supabase.com → New project (name it wabulk)
2. SQL Editor → paste and run backend/supabase-schema.sql
3. Then run these extra functions in the SQL editor:

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

### 2. Set up Upstash Redis

1. Go to upstash.com → Create database → choose a region
2. Copy the Redis URL (starts with rediss://)

### 3. Configure backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL, JWT_SECRET
# Also set ADMIN_EMAIL and ADMIN_PASSWORD_HASH
```

Generate admin password hash:
```bash
node -e "import('bcryptjs').then(m=>m.default.hash('YourPassword123',12).then(console.log))"
```
Copy the output (starting with $2b$) into ADMIN_PASSWORD_HASH in .env

### 4. Run locally (3 terminals)

Terminal 1 — Backend API:
```bash
cd backend && npm install && npm run dev
# Runs on http://localhost:4000
```

Terminal 2 — User dashboard:
```bash
cd frontend && npm install && npm run dev
# Runs on http://localhost:3000/app
```

Terminal 3 — Admin panel:
```bash
cd admin && npm install && npm run dev
# Runs on http://localhost:3001/admin
```

---

## Deploy to Railway

### Step 1 — Push to GitHub

From the wabulk root folder:
```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/yourusername/wabulk.git
git push -u origin main
```

### Step 2 — Create Railway project

1. Go to railway.app → Login with GitHub
2. New Project → Deploy from GitHub repo → select your wabulk repo
3. Set Root Directory to: backend
4. Railway auto-detects Node.js and uses railway.json

### Step 3 — Add environment variables on Railway

In Railway dashboard → your service → Variables:

```
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = your-service-role-key
REDIS_URL             = rediss://default:xxxx@xxxx.upstash.io:6379
JWT_SECRET            = any-long-random-string
NODE_ENV              = production
ADMIN_EMAIL           = admin@yourdomain.com
ADMIN_PASSWORD_HASH   = $2b$12$xxxx...
SESSION_PATH          = /data/wa-sessions
ALLOWED_ORIGIN        = https://your-app.up.railway.app
```

### Step 4 — Add persistent volume

Railway dashboard → your service → Volumes → Add volume
Mount path: /data

This saves WhatsApp sessions so users never have to re-scan after deploys.

### Step 5 — Done

Your app is live at https://your-app.up.railway.app

---

## Daily update workflow

```bash
# Edit any file on your Mac
# Then deploy:
git add .
git commit -m "describe your change"
git push
# Railway auto-builds and deploys in ~2-3 minutes
```

---

## API reference

Send bulk messages:
```bash
curl -X POST https://your-app.up.railway.app/v1/messages/send \
  -H "Authorization: Bearer wabk_live_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "your-wa-session-uuid",
    "template": "Hi {{name}}, your {{plan}} expires on {{date}}.",
    "messages": [
      { "to": "+919876543210", "vars": { "name": "Rahul", "plan": "Gold", "date": "25 Apr" } }
    ],
    "delay_ms": 3000
  }'
```

---

## All URLs on production

| URL | What it is |
|-----|-----------|
| your-app.up.railway.app | Marketing / landing page |
| your-app.up.railway.app/app | User signup, login, dashboard |
| your-app.up.railway.app/admin | Admin panel |
| your-app.up.railway.app/v1/messages/send | Send API |
| your-app.up.railway.app/health | Health check |
