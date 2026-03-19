import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import supabase from '../lib/supabase.js';
import fs from 'fs';
import path from 'path';

const SESSION_PATH = process.env.SESSION_PATH || './wa-sessions';

// In-memory map: sessionId -> Client instance
const clients = new Map();

if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

export async function createSession(sessionId, userId) {
  if (clients.has(sessionId)) {
    return { status: 'already_exists' };
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: SESSION_PATH,
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

  // Update DB status
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

  // Format number: strip + and add @c.us
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
}

export function getSessionStatus(sessionId) {
  return clients.has(sessionId) ? 'in_memory' : 'not_loaded';
}

export async function restoreAllSessions() {
  console.log('[WA] Restoring connected sessions from DB...');
  const { data: sessions } = await supabase
    .from('wa_sessions')
    .select('id, user_id')
    .eq('status', 'connected');

  if (!sessions?.length) return;

  for (const session of sessions) {
    try {
      await createSession(session.id, session.user_id);
    } catch (err) {
      console.error(`[WA] Failed to restore session ${session.id}:`, err.message);
    }
  }
  console.log(`[WA] Restored ${sessions.length} sessions`);
}

export { clients };
