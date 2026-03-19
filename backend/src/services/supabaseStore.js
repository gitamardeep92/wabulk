import supabase from '../lib/supabase.js';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';

/**
 * SupabaseStore — custom RemoteAuth store for whatsapp-web.js
 *
 * whatsapp-web.js RemoteAuth calls these methods:
 *   sessionExists({ session })  → returns true/false
 *   save({ session })           → zips the session folder and saves to Supabase
 *   extract({ session, path })  → loads from Supabase and unzips to path
 *   delete({ session })         → removes from Supabase
 *
 * Session data is stored as base64 in the wa_sessions.session_data column.
 * We zip the entire puppeteer session folder into a Buffer, base64 it, store it,
 * and reverse the process on restore. This survives Render redeploys completely.
 */

// We use the built-in zlib + tar via a simple recursive folder→base64 approach.
// For simplicity we use the 'archiver' + 'unzipper' pattern but to avoid extra deps
// we do a manual JSON-based approach: walk the session folder, read every file as
// base64, store as JSON. On restore, recreate the files. Works perfectly for the
// small auth credential files whatsapp-web.js writes.

async function folderToJson(folderPath) {
  const result = {};

  async function walk(dir, base) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(base, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else {
        const data = await fsp.readFile(fullPath);
        result[relPath] = data.toString('base64');
      }
    }
  }

  if (fs.existsSync(folderPath)) {
    await walk(folderPath, '');
  }
  return result;
}

async function jsonToFolder(folderPath, json) {
  for (const [relPath, b64] of Object.entries(json)) {
    const fullPath = path.join(folderPath, relPath);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, Buffer.from(b64, 'base64'));
  }
}

export class SupabaseStore {
  constructor() {
    this.name = 'SupabaseStore';
  }

  /**
   * Check if a saved session exists in Supabase for this sessionId
   */
  async sessionExists({ session }) {
    const { data } = await supabase
      .from('wa_sessions')
      .select('session_data')
      .eq('id', session)
      .single();

    const exists = !!(data?.session_data && Object.keys(data.session_data).length > 0);
    console.log(`[SupabaseStore] sessionExists(${session}): ${exists}`);
    return exists;
  }

  /**
   * Save current session folder contents to Supabase
   * Called by RemoteAuth after WhatsApp confirms authentication
   */
  async save({ session }) {
    try {
      // RemoteAuth creates a temp folder: .wwebjs_auth/RemoteAuth-{sessionId}
      const sessionFolder = path.join(process.cwd(), '.wwebjs_auth', `RemoteAuth-${session}`);
      console.log(`[SupabaseStore] Saving session ${session} from ${sessionFolder}`);

      const sessionJson = await folderToJson(sessionFolder);

      if (Object.keys(sessionJson).length === 0) {
        console.warn(`[SupabaseStore] No files found in session folder, skipping save`);
        return;
      }

      await supabase
        .from('wa_sessions')
        .update({
          session_data: sessionJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session);

      console.log(`[SupabaseStore] Session ${session} saved (${Object.keys(sessionJson).length} files)`);
    } catch (err) {
      console.error(`[SupabaseStore] Save error for ${session}:`, err.message);
      throw err;
    }
  }

  /**
   * Extract saved session from Supabase and write to local folder
   * Called by RemoteAuth on startup when restoring a session
   */
  async extract({ session, path: extractPath }) {
    try {
      console.log(`[SupabaseStore] Extracting session ${session} to ${extractPath}`);

      const { data } = await supabase
        .from('wa_sessions')
        .select('session_data')
        .eq('id', session)
        .single();

      if (!data?.session_data || Object.keys(data.session_data).length === 0) {
        console.warn(`[SupabaseStore] No session data found for ${session}`);
        return;
      }

      await fsp.mkdir(extractPath, { recursive: true });
      await jsonToFolder(extractPath, data.session_data);

      console.log(`[SupabaseStore] Session ${session} extracted (${Object.keys(data.session_data).length} files)`);
    } catch (err) {
      console.error(`[SupabaseStore] Extract error for ${session}:`, err.message);
      throw err;
    }
  }

  /**
   * Delete session data from Supabase
   * Called when user disconnects
   */
  async delete({ session }) {
    try {
      await supabase
        .from('wa_sessions')
        .update({
          session_data: {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', session);

      console.log(`[SupabaseStore] Session ${session} deleted from store`);
    } catch (err) {
      console.error(`[SupabaseStore] Delete error for ${session}:`, err.message);
    }
  }
}
