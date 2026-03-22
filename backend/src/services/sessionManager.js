import * as baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import supabase from '../lib/supabase.js';
import pino from 'pino';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// import * is the only reliable way to get Baileys exports in this Node/ESM version
const makeWASocket                = baileys.makeWASocket || baileys.default;
const DisconnectReason            = baileys.DisconnectReason;
const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
const useMultiFileAuthState       = baileys.useMultiFileAuthState;
const fetchLatestBaileysVersion   = baileys.fetchLatestBaileysVersion;

// Show warnings and errors from Baileys in Render logs
// but suppress the very verbose info/debug messages
const logger = pino({ level: 'warn' });
const clients = new Map();
const AUTH_DIR = path.join(process.cwd(), '.baileys-auth');

function sessionAuthPath(sessionId) {
  return path.join(AUTH_DIR, sessionId);
}

async function getSupabaseAuthState(sessionId) {
  const authPath = sessionAuthPath(sessionId);
  await fsp.mkdir(authPath, { recursive: true });

  // Load saved auth files from Supabase
  const { data: session } = await supabase
    .from('wa_sessions')
    .select('session_data')
    .eq('id', sessionId)
    .maybeSingle();

  if (session?.session_data && Object.keys(session.session_data).length > 0) {
    console.log(`[Baileys] Loading saved auth for ${sessionId}`);
    for (const [filename, b64] of Object.entries(session.session_data)) {
      const filePath = path.join(authPath, filename);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, Buffer.from(b64, 'base64'));
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  // Sync credentials back to Supabase after every save
  const saveCredsAndSync = async () => {
    await saveCreds();
    try {
      const files = {};
      const entries = await fsp.readdir(authPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const data = await fsp.readFile(path.join(authPath, entry.name));
          files[entry.name] = data.toString('base64');
        }
      }
      await supabase
        .from('wa_sessions')
        .update({ session_data: files, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (err) {
      console.warn(`[Baileys] Failed to sync creds for ${sessionId}:`, err.message);
    }
  };

  return { state, saveCreds: saveCredsAndSync };
}

async function cleanupAuthFolder(sessionId) {
  const authPath = sessionAuthPath(sessionId);
  if (fs.existsSync(authPath)) {
    try {
      await fsp.rm(authPath, { recursive: true, force: true });
    } catch {}
  }
}

// Check if a session still exists in the DB
async function sessionExistsInDb(sessionId) {
  const { data } = await supabase
    .from('wa_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();
  return !!data;
}

export async function createSession(sessionId, userId) {
  if (clients.has(sessionId)) {
    console.log(`[Baileys] Session ${sessionId} already in memory`);
    return { status: 'already_exists' };
  }

  // Check session still exists in DB before proceeding
  const exists = await sessionExistsInDb(sessionId);
  if (!exists) {
    console.log(`[Baileys] Session ${sessionId} no longer in DB, skipping`);
    return { status: 'not_found' };
  }

  console.log(`[Baileys] Starting session ${sessionId}`);

  await supabase
    .from('wa_sessions')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  try {
    // fetchLatestBaileysVersion makes an HTTP call to WA servers
    // Use a timeout so it doesn't hang forever on Render free tier
    let version;
    try {
      const result = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      version = result.version;
      console.log(`[Baileys] WA version: ${version.join('.')}`);
    } catch (err) {
      // Fallback to a known working version if fetch fails or times out
      version = [2, 3000, 1023504987];
      console.log(`[Baileys] Using fallback WA version: ${version.join('.')} (fetch failed: ${err.message})`);
    }
    const { state, saveCreds } = await getSupabaseAuthState(sessionId);

    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 20000,
    });

    clients.set(sessionId, sock);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR ready to scan
      if (qr) {
        console.log(`[Baileys] QR ready for ${sessionId}`);
        try {
          const qrBase64 = await qrcode.toDataURL(qr);
          await supabase
            .from('wa_sessions')
            .update({ status: 'qr_ready', qr_code: qrBase64, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        } catch (err) {
          console.error(`[Baileys] Failed to save QR for ${sessionId}:`, err.message);
        }
      }

      // Successfully connected
      if (connection === 'open') {
        console.log(`[Baileys] Connected: ${sessionId}`);
        const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
        await supabase
          .from('wa_sessions')
          .update({
            status: 'connected',
            phone_number: phoneNumber ? `+${phoneNumber}` : null,
            display_name: sock.user?.name || '',
            qr_code: null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      // Disconnected
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : 0;

        console.log(`[Baileys] Closed ${sessionId} — code: ${statusCode}`);
        clients.delete(sessionId);

        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const sessionGone = statusCode === 401 || statusCode === 403;

        if (loggedOut || sessionGone) {
          // User logged out from phone — clean up completely
          console.log(`[Baileys] Logged out: ${sessionId}`);
          await cleanupAuthFolder(sessionId);
          // Only update if session still exists in DB
          const stillExists = await sessionExistsInDb(sessionId);
          if (stillExists) {
            await supabase
              .from('wa_sessions')
              .update({ status: 'disconnected', session_data: {}, updated_at: new Date().toISOString() })
              .eq('id', sessionId);
          }
        } else {
          // Network error or timeout — try to reconnect
          // But ONLY if session still exists in DB (not manually deleted)
          const stillExists = await sessionExistsInDb(sessionId);
          if (stillExists) {
            console.log(`[Baileys] Network issue, reconnecting ${sessionId} in 8s...`);
            setTimeout(() => createSession(sessionId, userId), 8000);
          } else {
            console.log(`[Baileys] Session ${sessionId} was deleted, not reconnecting`);
          }
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    return { status: 'initializing' };

  } catch (err) {
    console.error(`[Baileys] Error creating session ${sessionId}:`, err.message);
    clients.delete(sessionId);
    // Only update DB if session still exists
    const stillExists = await sessionExistsInDb(sessionId);
    if (stillExists) {
      await supabase
        .from('wa_sessions')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    throw err;
  }
}

export async function sendMessage(sessionId, toNumber, message) {
  const sock = clients.get(sessionId);
  if (!sock) throw new Error(`Session ${sessionId} not in memory`);
  const jid = toNumber.replace(/\D/g, '') + '@s.whatsapp.net';
  const result = await sock.sendMessage(jid, { text: message });
  return result?.key?.id || 'sent';
}

export async function disconnectSession(sessionId) {
  const sock = clients.get(sessionId);
  if (sock) {
    try { await sock.logout(); } catch {}
    clients.delete(sessionId);
  }
  try { await cleanupAuthFolder(sessionId); } catch {}
}

export function getSessionStatus(sessionId) {
  return clients.has(sessionId) ? 'in_memory' : 'not_loaded';
}

export async function restoreAllSessions() {
  console.log('[Baileys] Restoring sessions...');
  const { data: sessions } = await supabase
    .from('wa_sessions')
    .select('id, user_id, phone_number')
    .eq('status', 'connected');

  if (!sessions?.length) { console.log('[Baileys] Nothing to restore'); return; }

  for (const session of sessions) {
    try {
      await createSession(session.id, session.user_id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[Baileys] Failed to restore ${session.id}:`, err.message);
      await supabase
        .from('wa_sessions')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', session.id);
    }
  }

  // After 30s check which sessions are still not in memory
  setTimeout(async () => {
    const { data: stillConnected } = await supabase
      .from('wa_sessions').select('id').eq('status', 'connected');
    for (const s of (stillConnected || [])) {
      if (!clients.has(s.id)) {
        await supabase
          .from('wa_sessions')
          .update({ status: 'disconnected', updated_at: new Date().toISOString() })
          .eq('id', s.id);
      }
    }
  }, 30000);

  console.log('[Baileys] Restore initiated');
}

export { clients };

// Request pairing code (alternative to QR for connecting via phone number)
export async function requestPairingCode(sessionId, phoneNumber) {
  const sock = clients.get(sessionId);
  if (!sock) throw new Error('Session not in memory. Try reconnecting.');
  
  // Phone number must be digits only, no + or spaces
  const clean = phoneNumber.replace(/\D/g, '');
  if (!clean || clean.length < 7) throw new Error('Invalid phone number');
  
  try {
    const code = await sock.requestPairingCode(clean);
    console.log(`[Baileys] Pairing code for ${sessionId}: ${code}`);
    
    await supabase.from('wa_sessions')
      .update({ status: 'pairing', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    return code;
  } catch (err) {
    console.error(`[Baileys] Pairing code error:`, err.message);
    throw new Error('Could not generate pairing code. Make sure the session is ready.');
  }
}
