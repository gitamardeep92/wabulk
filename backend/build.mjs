/**
 * build.mjs
 * Runs as: node build.mjs  (called from backend/ directory)
 *
 * Builds frontend + admin IN PARALLEL then copies into backend/public/
 * Parallel builds cut total time roughly in half.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT      = path.resolve(__dirname, '..');
const FRONTEND  = path.join(ROOT, 'frontend');
const ADMIN     = path.join(ROOT, 'admin');
const MARKETING = path.join(ROOT, 'marketing');
const PUBLIC    = path.join(__dirname, 'public');

// Run a command synchronously and stream output
function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${path.basename(cwd)})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Run a command async (for parallel execution)
async function runAsync(cmd, cwd) {
  console.log(`▶ ${cmd}  (in ${path.basename(cwd)})`);
  const { stdout, stderr } = await execAsync(cmd, { cwd });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

// Copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const start = Date.now();

console.log('═══════════════════════════════════════');
console.log('  WaBulk build starting (parallel)...');
console.log('═══════════════════════════════════════');

// ── Step 1: Install deps for frontend + admin IN PARALLEL ──
console.log('\n[1/3] Installing frontend + admin dependencies in parallel...');
await Promise.all([
  runAsync('npm install --include=dev --legacy-peer-deps', FRONTEND),
  runAsync('npm install --include=dev --legacy-peer-deps', ADMIN),
]);
console.log('✓ Dependencies installed');

// ── Step 2: Build frontend + admin IN PARALLEL ─────────────
console.log('\n[2/3] Building frontend + admin in parallel...');
await Promise.all([
  runAsync('./node_modules/.bin/vite build', FRONTEND),
  runAsync('./node_modules/.bin/vite build', ADMIN),
]);
console.log('✓ Builds complete');

// ── Step 3: Copy output files ───────────────────────────────
console.log('\n[3/3] Copying build output...');

const frontendOut = path.join(PUBLIC, 'app');
const adminOut    = path.join(PUBLIC, 'admin');
const marketingOut = path.join(PUBLIC, 'marketing');

if (fs.existsSync(frontendOut))  fs.rmSync(frontendOut,  { recursive: true });
if (fs.existsSync(adminOut))     fs.rmSync(adminOut,     { recursive: true });
if (fs.existsSync(marketingOut)) fs.rmSync(marketingOut, { recursive: true });

copyDir(path.join(FRONTEND, 'dist'), frontendOut);
copyDir(path.join(ADMIN,    'dist'), adminOut);
copyDir(MARKETING, marketingOut);

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log('\n═══════════════════════════════════════');
console.log(`  Build complete in ${elapsed}s ✓`);
console.log('  public/app/        → dashboard');
console.log('  public/admin/      → admin panel');
console.log('  public/marketing/  → marketing site');
console.log('═══════════════════════════════════════\n');
