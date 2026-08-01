/**
 * Generates js/config.js from environment variables.
 *
 * Local:   node --env-file=.env scripts/generate-config.js
 * Netlify: set SANITY_TOKEN in Netlify env vars, runs as build command
 *
 * js/config.js is gitignored — it only exists locally and on the deployed server.
 */

const fs = require('fs');
const path = require('path');

const token = process.env.SANITY_TOKEN;

if (!token || token === 'sk...') {
  console.error('❌ SANITY_TOKEN is required. Set it in .env or Netlify environment variables.');
  process.exit(1);
}

const config = [
  '/**',
  ' * SANITY CONFIG — auto-generated from environment variables.',
  ' * DO NOT commit this file.',
  ' */',
  'window.SanityConfig = {',
  "  projectId: '" + (process.env.SANITY_PROJECT_ID || 'sm9yflxc') + "',",
  "  dataset: '" + (process.env.SANITY_DATASET || 'production') + "',",
  "  token: '" + token + "',",
  "  apiVersion: '2023-08-01',",
  "  docType: 'tribute',",
  "  approvedOnly: true,",
  '};',
  '',
].join('\n');

const outPath = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(outPath, config, 'utf8');
console.log('✅ Generated js/config.js');
