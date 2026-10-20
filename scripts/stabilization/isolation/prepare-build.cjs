/* eslint-disable @typescript-eslint/no-require-imports -- Clean local build inputs; never copies runtime secrets or database contents. */
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..'), out = path.join(root, 'output/permanent-isolation-20261020'), build = path.join(out, 'build-source');
const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
const extra = ['lib/db/environment.ts', 'lib/db/runtime-environment.ts', 'scripts/test-environment-isolation.cjs', 'scripts/stabilization/isolation/prepare-build.cjs'];
const files = [...new Set([...git(['ls-files']).split('\n'), ...extra])].filter(f => f && !/^(output|\.wrangler|\.git|\.codex|\.agents|\.aws)\//.test(f) && !/(^|\/)\.env[^/]*$/.test(f) && fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile());
fs.mkdirSync(build, { recursive: true });
for (const file of git(['diff', '--name-only', '--diff-filter=D']).split('\n').filter(Boolean)) {
  if (file.split('/').includes('..')) throw Error('Unsafe deleted input');
  const previous = path.join(build, file);
  if (fs.existsSync(previous) && fs.statSync(previous).isFile()) fs.unlinkSync(previous);
}
const manifest = [];
for (const file of files) {
  if (file.startsWith('output/') || file.split('/').includes('..') || file.startsWith('.wrangler/')) throw Error('Unsafe build input');
  const dest = path.join(build, file), bytes = fs.readFileSync(path.join(root, file)); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
  manifest.push({ file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
const modules = path.join(build, 'node_modules');
if (fs.existsSync(modules) && fs.lstatSync(modules).isSymbolicLink()) {
  if (fs.realpathSync(modules) !== fs.realpathSync(path.join(root, 'node_modules'))) throw Error('Unexpected dependency junction');
  // rmdir removes this verified junction only, never the dependency target.
  fs.rmdirSync(modules);
  for (const name of ['.next', '.open-next']) {
    const generated = path.join(build, name), previous = path.join(build, name + '-junction-attempt');
    if (fs.existsSync(generated) && !fs.existsSync(previous)) {
      if (fs.realpathSync(generated) !== generated) throw Error('Unexpected generated directory link');
      fs.renameSync(generated, previous);
    }
  }
}
if (!fs.existsSync(modules)) fs.cpSync(path.join(root, 'node_modules'), modules, { recursive: true, dereference: true });
fs.writeFileSync(path.join(out, 'build-source-inputs.json'), JSON.stringify({ baseCommit: git(['rev-parse', 'HEAD']), files: manifest, digest: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), noDotenvFilesCopied: true, localOnly: true }, null, 2));
console.log('Prepared clean source build with ' + files.length + ' inputs; dotenv, databases and remote credentials excluded.');
