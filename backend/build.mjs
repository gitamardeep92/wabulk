/**
 * build.mjs
 * Runs as: node build.mjs  (called from backend/ directory)
 *
 * Builds frontend + admin with their own node_modules,
 * then copies everything into backend/public/
 * Works reliably on Render, Railway, and local Mac.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// All paths relative to backend/ (where this script lives)
const ROOT        = path.resolve(__dirname, '..');
const FRONTEND    = path.join(ROOT, 'frontend');
const ADMIN       = path.join(ROOT, 'admin');
const MARKETING   = path.join(ROOT, 'marketing');
const PUBLIC      = path.join(__dirname, 'public');

// Helper: run a shell command in a specific directory and stream output
function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Helper: copy a directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('═══════════════════════════════════════');
console.log('  WaBulk build starting...');
console.log('═══════════════════════════════════════');

// ── 1. Build frontend dashboard ──────────────────────────
console.log('\n[1/3] Building frontend dashboard...');
run('npm install', FRONTEND);
run('./node_modules/.bin/vite build', FRONTEND);
const frontendDist = path.join(FRONTEND, 'dist');
const frontendOut  = path.join(PUBLIC, 'app');
if (fs.existsSync(frontendOut)) fs.rmSync(frontendOut, { recursive: true });
copyDir(frontendDist, frontendOut);
console.log(`✓ Frontend copied to public/app/`);

// ── 2. Build admin panel ─────────────────────────────────
console.log('\n[2/3] Building admin panel...');
run('npm install', ADMIN);
run('./node_modules/.bin/vite build', ADMIN);
const adminDist = path.join(ADMIN, 'dist');
const adminOut  = path.join(PUBLIC, 'admin');
if (fs.existsSync(adminOut)) fs.rmSync(adminOut, { recursive: true });
copyDir(adminDist, adminOut);
console.log(`✓ Admin copied to public/admin/`);

// ── 3. Copy marketing site ───────────────────────────────
console.log('\n[3/3] Copying marketing site...');
const marketingOut = path.join(PUBLIC, 'marketing');
if (fs.existsSync(marketingOut)) fs.rmSync(marketingOut, { recursive: true });
copyDir(MARKETING, marketingOut);
console.log(`✓ Marketing copied to public/marketing/`);

// ── Done ─────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════');
console.log('  Build complete ✓');
console.log('  public/app/        → dashboard');
console.log('  public/admin/      → admin panel');
console.log('  public/marketing/  → marketing site');
console.log('═══════════════════════════════════════\n');
