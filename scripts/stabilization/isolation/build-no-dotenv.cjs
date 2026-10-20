/* eslint-disable @typescript-eslint/no-require-imports -- Build-process-only preload; never part of Worker runtime. */
const fs = require('node:fs'), path = require('node:path'), { syncBuiltinESMExports } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const empty = path.join(root, 'output/permanent-isolation-20261020/empty-build-env');
fs.mkdirSync(empty, { recursive: true });
if (fs.readdirSync(empty).length) throw Error('Build environment directory must be empty');
// Next 16.1.6 reuses @next/env's first cached result for ordinary build/config
// calls. Prime that cache from an empty directory; do not read the root .env.
const loaded = require(path.join(root, 'node_modules/@next/env')).loadEnvConfig(empty, false);
if (loaded.loadedEnvFiles.length) throw Error('Build environment directory must be empty');
const forbidden = value => (typeof value === 'string' || value instanceof URL) && /^\.env(?:\.|$)/.test(path.basename(String(value)));
// OpenNext also probes dotenv files directly when compiling next-env.mjs.
// Make those probes see a clean checkout while retaining the hard read guard.
const exists = fs.existsSync;
fs.existsSync = function(file) { return forbidden(file) ? false : exists.call(this, file); };
for (const name of ['readFileSync', 'copyFileSync']) {
  const original = fs[name];
  fs[name] = function(source, ...args) { if (forbidden(source)) throw Error('BUILD_DOTENV_READ_BLOCKED'); return original.call(this, source, ...args); };
}
for (const name of ['readFile', 'copyFile']) {
  const original = fs.promises[name];
  fs.promises[name] = async function(source, ...args) { if (forbidden(source)) throw Error('BUILD_DOTENV_READ_BLOCKED'); return original.call(this, source, ...args); };
}
syncBuiltinESMExports();
