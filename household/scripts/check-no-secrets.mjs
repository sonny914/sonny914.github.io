// Fails the build if a privileged Supabase key could reach the browser.
// Scans the source, HTML, env files and the built output for service-role / secret keys.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'index.html', 'public', 'dist', '.env', '.env.local', '.env.production', '.env.example'];
const skip = /\.(woff2?|png|jpe?g|webp|ico|svg)$|\.test\.tsx?$/;
const jwt = /eyJ[\w-]{10,}\.([\w-]{10,})\.[\w-]+/g;
const problems = [];

function role(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role;
  } catch {
    return undefined;
  }
}
function scan(file) {
  const text = readFileSync(file, 'utf8');
  if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(text)) problems.push(`${file}: contains an sb_secret_ key`);
  if (/SERVICE_ROLE_KEY\s*=\s*\S+/i.test(text)) problems.push(`${file}: assigns a SERVICE_ROLE_KEY`);
  // The schedule reader's Anthropic key lives on the server only. A VITE_ name would ship it to every browser.
  if (/sk-ant-[A-Za-z0-9_-]{20,}/.test(text)) problems.push(`${file}: contains an Anthropic API key`);
  if (/VITE_ANTHROPIC/i.test(text)) problems.push(`${file}: names a VITE_ANTHROPIC variable; the Anthropic key must never be a VITE_ variable`);
  for (const m of text.matchAll(jwt)) if (role(m[1]) === 'service_role') problems.push(`${file}: contains a service_role JWT`);
}
function walk(p) {
  if (!existsSync(p)) return;
  if (statSync(p).isDirectory()) return readdirSync(p).forEach((n) => walk(join(p, n)));
  if (!skip.test(p)) scan(p);
}
roots.forEach(walk);

if (problems.length) {
  console.error('A privileged key must never be in browser code:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log('check-no-secrets: no privileged keys found.');
