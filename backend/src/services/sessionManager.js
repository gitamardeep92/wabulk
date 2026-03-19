/**
 * sessionManager.js — Baileys-based WhatsApp session manager
 *
 * Uses @whiskeysockets/baileys which connects to WhatsApp
 * directly via WebSocket. No Chrome, no Puppeteer, no browser.
 * Memory usage: ~50MB vs ~400MB for whatsapp-web.js
 *
 * Sessions are stored in Supabase so they survive Render redeploys.
 */

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import supabase from '../lib/supabase.js';
import pino from 'pino';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// Silent logger — Baileys is very verbose by default
const logger = pino({ level: 'silent' });

// In-memory map: sessionId → socket instance
const clients = new Map();

// Temp directory for Baileys auth files (per session)
const AUTH_DIR = path.join(process.cwd(), '.baileys-auth');

function sessionAuthPath(sessionId) {
  return path.join(AUTH_DIR, sessionId);
}

/**
 * Load session auth state from Supabase into a temp folder,
 * then use Baileys' useMultiFileAuthState on that folder.
 * On save, sync back to Supabase.
 */
async function getSupabaseAuthState(sessionId) {
  const authPath = sessionAuthPath(sessionId);
  await fsp.mkdir(authPath, { recursive: true });

  // Load existing auth files from Supabase into temp folder
  const { data: session } = await supabase
    .from('wa_sessions')
    .select('session_data')
    .eq('id', sessionId)
    .single();

  if (session?.session_data && Object.keys(session.session_data).length > 0) {
    console.log(`[Baileys] Restoring auth files for ${sessionId}`);
    for (const [filename, b64] of Object.entries(session.session_data)) {
      const filePath = path.join(authPath, filename);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, Buffer.from(b64, 'base64'));
    }
  }

  // Use Baileys' built-in multi-file auth state on the temp folder
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  // Wrap saveCreds to also sync back to Supabase
  const saveCredsAndSync = async () => {
    await saveCreds(); // save to local temp folder first

    // Read all files from temp folder and store as base64 in Supabase
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
      .update({
        session_data: files,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    console.log(`[Baileys] Auth saved to Supabase for ${sessionId} (${Object.keys(files).length} files)`);
  };

  return { state, saveCreds: saveCredsAndSync };
}

/**
 * Clean up temp auth folder for a session
 */
async function cleanupAuthFolder(sessionId) {
  const authPath = sessionAuthPath(sessionId);
  if (fs.existsSync(authPath)) {
    await fsp.rm(authPath, { recursive: true, force: true });
  }
}

/**
 * Create a new Baileys WhatsApp session
 */
export async function createSession(sessionId, userId) {
  if (clients.has(sessionId)) {
    console.log(`[Baileys] Session ${sessionId} already in memory`);
    return { status: 'already_exists' };
  }

  console.log(`[Baileys] Creating session ${sessionId}`);

  await supabase
    .from('wa_sessions')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  try {
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[Baileys] Using WA version ${version.join('.')}`);

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
    });

    clients.set(sessionId, sock);

    // ── QR code event ──────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[Baileys] QR generated for session ${sessionId}`);
        const qrBase64 = await qrcode.toDataURL(qr);
        await supabase
          .from('wa_sessions')
          .update({
            status: 'qr_ready',
            qr_code: qrBase64,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      if (connection === 'open') {
        console.log(`[Baileys] Session ${sessionId} connected!`);
        const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
        const displayName = sock.user?.name || '';

        await supabase
          .from('wa_sessions')
          .update({
            status: 'connected',
            phone_number: phoneNumber ? `+${phoneNumber}` : null,
            display_name: displayName,
            qr_code: null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : 0;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Baileys] Session ${sessionId} closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

        clients.delete(sessionId);

        if (shouldReconnect) {
          // Auto-reconnect after a short delay
          console.log(`[Baileys] Reconnecting session ${sessionId} in 5s...`);
          setTimeout(() => createSession(sessionId, userId), 5000);
        } else {
          // Logged out — clear session data
          console.log(`[Baileys] Session ${sessionId} logged out, clearing data`);
          await cleanupAuthFolder(sessionId);
          await supabase
            .from('wa_sessions')
            .update({
              status: 'disconnected',
              session_data: {},
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
        }
      }
    });

    // ── Save credentials whenever they update ──────────────
    sock.ev.on('creds.update', saveCreds);

    return { status: 'initializing' };

  } catch (err) {
    console.error(`[Baileys] Failed to create session ${sessionId}:`, err.message);
    clients.delete(sessionId);
    await supabase
      .from('wa_sessions')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    throw err;
  }
}

/**
 * Send a text message via a session
 */
export async function sendMessage(sessionId, toNumber, message) {
  const sock = clients.get(sessionId);
  if (!sock) {
    throw new Error(`Session ${sessionId} not found or not connected`);
  }

  // Format: strip non-digits, add @s.whatsapp.net
  const jid = toNumber.replace(/\D/g, '') + '@s.whatsapp.net';

  const result = await sock.sendMessage(jid, { text: message });
  return result?.key?.id || 'sent';
}

/**
 * Disconnect and clean up a session
 */
export async function disconnectSession(sessionId) {
  const sock = clients.get(sessionId);
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    clients.delete(sessionId);
  }

  await cleanupAuthFolder(sessionId);

  await supabase
    .from('wa_sessions')
    .update({
      status: 'disconnected',
      session_data: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

export function getSessionStatus(sessionId) {
  return clients.has(sessionId) ? 'in_memory' : 'not_loaded';
}

/**
 * Restore all connected sessions from Supabase on server startup
 */
export async function restoreAllSessions() {
  console.log('[Baileys] Restoring sessions from Supabase...');

  const { data: sessions } = await supabase
    .from('wa_sessions')
    .select('id, user_id, phone_number')
    .eq('status', 'connected');

  if (!sessions?.length) {
    console.log('[Baileys] No sessions to restore');
    return;
  }

  console.log(`[Baileys] Restoring ${sessions.length} session(s)...`);

  for (const session of sessions) {
    try {
      console.log(`[Baileys] Restoring ${session.phone_number || session.id}`);
      await createSession(session.id, session.user_id);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[Baileys] Failed to restore ${session.id}:`, err.message);
      await supabase
        .from('wa_sessions')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', session.id);
    }
  }

  console.log('[Baileys] Session restore complete');
}

export { clients };
