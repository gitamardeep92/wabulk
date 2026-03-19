import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg;
import qrcode from 'qrcode';
import supabase from '../lib/supabase.js';
import { SupabaseStore } from './supabaseStore.js';

// In-memory map: sessionId -> Client instance
const clients = new Map();

export async function createSession(sessionId, userId) {
  if (clients.has(sessionId)) {
    console.log(`[WA] Session ${sessionId} already in memory`);
    return { status: 'already_exists' };
  }

  console.log(`[WA] Creating session ${sessionId}`);

  const store = new SupabaseStore();

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: sessionId,
      store,
      backupSyncIntervalMs: 60000, // sync to Supabase every 60s
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  });

  clients.set(sessionId, client);

  await supabase
    .from('wa_sessions')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  client.on('qr', async (qr) => {
    console.log(`[WA] QR generated for session ${sessionId}`);
    const qrBase64 = await qrcode.toDataURL(qr);
    await supabase
      .from('wa_sessions')
      .update({ status: 'qr_ready', qr_code: qrBase64, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  });

  client.on('ready', async () => {
    console.log(`[WA] Session ${sessionId} ready!`);
    const info = client.info;
    await supabase
      .from('wa_sessions')
      .update({
        status: 'connected',
        phone_number: '+' + info.wid.user,
        display_name: info.pushname,
        qr_code: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  });

  client.on('remote_session_saved', () => {
    console.log(`[WA] Session ${sessionId} saved to Supabase`);
  });

  client.on('disconnected', async (reason) => {
    console.log(`[WA] Session ${sessionId} disconnected:`, reason);
    clients.delete(sessionId);
    await supabase
      .from('wa_sessions')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  });

  client.on('auth_failure', async (msg) => {
    console.error(`[WA] Auth failure for session ${sessionId}:`, msg);
    clients.delete(sessionId);
    await supabase
      .from('wa_sessions')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  });

  await client.initialize();
  return { status: 'initializing' };
}

export async function sendMessage(sessionId, toNumber, message) {
  const client = clients.get(sessionId);
  if (!client) {
    throw new Error(`Session ${sessionId} not found or not connected`);
  }
  const chatId = toNumber.replace(/\D/g, '') + '@c.us';
  const result = await client.sendMessage(chatId, message);
  return result.id._serialized;
}

export async function disconnectSession(sessionId) {
  const client = clients.get(sessionId);
  if (client) {
    await client.destroy();
    clients.delete(sessionId);
  }
  const store = new SupabaseStore();
  await store.delete({ session: sessionId });
}

export function getSessionStatus(sessionId) {
  return clients.has(sessionId) ? 'in_memory' : 'not_loaded';
}

export async function restoreAllSessions() {
  console.log('[WA] Restoring sessions from Supabase...');

  const { data: sessions } = await supabase
    .from('wa_sessions')
    .select('id, user_id, phone_number')
    .eq('status', 'connected');

  if (!sessions?.length) {
    console.log('[WA] No sessions to restore');
    return;
  }

  console.log(`[WA] Restoring ${sessions.length} session(s)...`);

  for (const session of sessions) {
    try {
      console.log(`[WA] Restoring ${session.phone_number || session.id}`);
      await createSession(session.id, session.user_id);
      await new Promise((r) => setTimeout(r, 3000)); // stagger restores
    } catch (err) {
      console.error(`[WA] Failed to restore ${session.id}:`, err.message);
      await supabase
        .from('wa_sessions')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', session.id);
    }
  }

  console.log('[WA] Session restore complete');
}

export { clients };
