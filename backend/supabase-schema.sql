-- ============================================================
-- WaBulk Database Schema for Supabase
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  company text,
  plan text not null default 'free',       -- free | starter | pro
  status text not null default 'active',   -- active | suspended | deleted
  email_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- API KEYS TABLE
-- ============================================================
create table public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  key_hash text unique not null,        -- bcrypt hash of the actual key
  key_prefix text not null,             -- first 8 chars visible (e.g. wabk_liv)
  name text not null default 'Default', -- user-defined label
  is_active boolean default true,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- WA SESSIONS TABLE (one per connected WA number)
-- ============================================================
create table public.wa_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  phone_number text,                    -- +91XXXXXXXXXX
  display_name text,                    -- WhatsApp account name
  status text not null default 'pending', -- pending | qr_ready | connected | disconnected
  session_data jsonb,                   -- encrypted serialized session
  qr_code text,                         -- base64 QR (temporary, for scanning)
  connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TEMPLATES TABLE
-- ============================================================
create table public.templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  body text not null,                   -- "Hi {{name}}, your {{plan}} expires {{date}}"
  variables jsonb default '[]',         -- ["name","plan","date"]
  category text default 'notification', -- notification | transactional | reminder
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGNS TABLE
-- ============================================================
create table public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.wa_sessions(id),
  template_id uuid references public.templates(id),
  name text not null,
  status text not null default 'queued', -- queued | sending | completed | failed | cancelled
  total_recipients integer default 0,
  sent_count integer default 0,
  delivered_count integer default 0,
  failed_count integer default 0,
  delay_ms integer default 3000,        -- delay between messages in ms
  scheduled_at timestamptz,             -- null = send immediately
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- MESSAGES TABLE (individual messages within a campaign)
-- ============================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  to_number text not null,              -- +91XXXXXXXXXX
  rendered_body text not null,          -- final resolved message text
  variables jsonb default '{}',         -- {"name":"Rahul","plan":"Gold"}
  status text not null default 'queued', -- queued | sending | sent | delivered | failed
  error_message text,
  wa_message_id text,                   -- WhatsApp message ID for tracking
  queued_at timestamptz default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz
);

-- ============================================================
-- USAGE TABLE (for plan enforcement)
-- ============================================================
create table public.usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  month text not null,                  -- "2025-10" (YYYY-MM)
  messages_sent integer default 0,
  api_calls integer default 0,
  unique(user_id, month)
);

-- ============================================================
-- PLAN LIMITS TABLE (editable from admin)
-- ============================================================
create table public.plan_limits (
  plan text primary key,
  monthly_messages integer not null,
  max_sessions integer not null,
  api_calls_per_minute integer not null,
  scheduled_sending boolean default false,
  webhooks boolean default false,
  price_inr integer default 0
);

insert into public.plan_limits values
  ('free',    500,   1, 10,  false, false, 0),
  ('starter', 10000, 3, 100, true,  true,  999),
  ('pro',     -1,    10, 1000, true, true,  3999); -- -1 = unlimited

-- ============================================================
-- WEBHOOK ENDPOINTS TABLE
-- ============================================================
create table public.webhooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  url text not null,
  secret text,                          -- for HMAC signature
  events jsonb default '["delivered","failed"]',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- ADMIN AUDIT LOG
-- ============================================================
create table public.admin_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_email text not null,
  action text not null,
  target_type text,                     -- user | campaign | session
  target_id text,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.api_keys enable row level security;
alter table public.wa_sessions enable row level security;
alter table public.templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.messages enable row level security;
alter table public.usage enable row level security;
alter table public.webhooks enable row level security;

-- Backend uses service role key (bypasses RLS), so RLS mainly
-- protects against direct client access. Policies below for reference.
create policy "users own data" on public.users for all using (id = auth.uid());

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index on public.messages(campaign_id);
create index on public.messages(user_id);
create index on public.messages(status);
create index on public.campaigns(user_id);
create index on public.campaigns(status);
create index on public.wa_sessions(user_id);
create index on public.usage(user_id, month);
create index on public.api_keys(key_hash);

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  custom_data jsonb default '{}',   -- any extra fields from CSV
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, phone)
);

-- ============================================================
-- CONTACT GROUPS TABLE
-- ============================================================
create table if not exists public.contact_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  description text,
  contact_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CONTACT GROUP MEMBERS
-- ============================================================
create table if not exists public.contact_group_members (
  group_id uuid references public.contact_groups(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  primary key (group_id, contact_id)
);

-- Indexes
create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_contact_groups_user_id on public.contact_groups(user_id);
create index if not exists idx_contact_group_members_group on public.contact_group_members(group_id);
create index if not exists idx_contact_group_members_contact on public.contact_group_members(contact_id);

-- Function to keep contact_count updated
create or replace function update_group_contact_count()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    update contact_groups set contact_count = contact_count + 1 where id = NEW.group_id;
  elsif (TG_OP = 'DELETE') then
    update contact_groups set contact_count = contact_count - 1 where id = OLD.group_id;
  end if;
  return null;
end; $$;

create or replace trigger trg_group_count
after insert or delete on public.contact_group_members
for each row execute function update_group_contact_count();
