const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { validateManualDeployment } = require('../validate-manual-deploy.cjs');

const root = path.resolve(__dirname, '../..');
// Legacy databases have different migration histories. Only reviewed additions
// after this commit can enter the automatic release directory.
const migrationBase = '9539a47118123ea4e28da09ac9b3f525f24c37b9';
const reviewed = {
  '0197_ehb_rab_autosave.sql': 'b78aaf49f8c843c6a98da8a5bf309f6b91f6010c4516ea015b6fc089613a3a5b',
  '0198_manual_transfer_and_collective_payout.sql': '1d208ac9b74a00ec0e8203b98de30f07427de509ad00a2854108d9d1115e3b36',
  '0199_finance_koperasi_menu_access.sql': '888ec2cbd4d51d1a6bfb95093c156ac9e31a8e55867ff62efe2416043b6a6168',
  '0200_finance_cash_transfers.sql': 'a6c879bd05237e25ca65fe2ba52babc75851d8acde6ff871cc5bee737c96ce46',
};

function validateMigrationChanges(changes) {
  for (const [status, file] of changes) {
    const name = path.posix.basename(file);
    assert.ok(status === 'A' && file === 'migrations/' + name && Object.hasOwn(reviewed, name),
      'Release migration must be a reviewed new file: ' + file);
  }
}

function reviewedFiles() {
  return Object.entries(reviewed).map(([name, hash]) => {
    const sql = fs.readFileSync(path.join(root, 'migrations', name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(sql).digest('hex'), hash, 'Migration content changed: ' + name);
    return { name, sql };
  });
}

function prepareMigrationConfig(config, target, destination) {
  const selected = target === 'sandbox' ? config.env.sandbox : config;
  const binding = selected.d1_databases.find(database => database.binding === 'DB');
  const migrationDir = path.join(destination, 'release-migrations');
  fs.mkdirSync(migrationDir);
  for (const { name, sql } of reviewedFiles()) fs.writeFileSync(path.join(migrationDir, name), sql);
  const filename = path.join(destination, 'wrangler.json');
  fs.writeFileSync(filename, JSON.stringify({
    name: selected.name,
    account_id: config.account_id,
    d1_databases: [{
      binding: 'DB',
      database_name: binding.database_name,
      database_id: binding.database_id,
      migrations_dir: 'release-migrations',
      migrations_table: 'd1_migrations',
    }],
  }));
  return { filename, database: binding.database_name };
}

function apply(target) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Remote migrations run in GitHub Actions');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Remote migrations require a push');
  assert.equal(process.env.ESKAHADE_AUTOMATED_RELEASE, 'true', 'Automated release context required');
  assert.ok(process.env.RUNNER_TEMP && process.env.CLOUDFLARE_API_TOKEN, 'Runner temp and D1 credentials required');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    process.env.GITHUB_SHA, 'Migration checkout must match the release commit');
  const { config, error } = ts.parseConfigFileTextToJson('wrangler.jsonc',
    fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.ok(!error, 'Invalid Wrangler config');
  validateManualDeployment(config, target);
  const destination = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'eskahade-d1-'));
  const { filename, database } = prepareMigrationConfig(config, target, destination);
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'd1', 'migrations', 'apply', database, '--config', filename, '--remote',
  ], {
    cwd: destination,
    // Config contains only the already validated binding for this target.
    env: { ...process.env, CLOUDFLARE_ENV: '' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'D1 migrations failed for ' + target);
}

if (require.main === module) {
  try {
    if (process.argv[2] === '--check') {
      const changeList = execFileSync('git', [
        'diff', '--name-status', '--no-renames', migrationBase, 'HEAD', '--', 'migrations',
      ], { cwd: root, encoding: 'utf8' });
      validateMigrationChanges(changeList.trim().split(/\r?\n/).filter(Boolean).map(line => line.split('\t')));
      reviewedFiles();
      console.log('Reviewed release migrations verified.');
    } else if (process.argv[2] === '--apply') {
      apply(process.argv[3]);
    } else {
      throw new Error('Use --check or --apply <sandbox|production>');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareMigrationConfig, validateMigrationChanges };
