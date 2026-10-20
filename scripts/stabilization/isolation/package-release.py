"""Build one reviewable source/patch/evidence ZIP. Never includes dotenv, DB or dependencies."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
import shutil
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'output/permanent-isolation-20261020'
DEST = ROOT / 'output/eskahade-permanent-isolation-20261020'
BASE = 'ade5b89b837a82fe824f9f61aff055d50f893674'

def git(*args, check=True):
    return subprocess.run(['git', '-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', *args], cwd=ROOT, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def report(name):
    return json.loads((EVIDENCE / name).read_text(encoding='utf-8-sig'))

def main():
    assert git('rev-parse', 'HEAD').stdout.decode().strip() == BASE
    regression = report('regression/results.json')
    assert regression['summary']['failed'] == 0
    for name in ['isolation-unit.json', 'config-tests.json', 'background-tests.json', 'maintenance-tests.json', 'http-smoke.json']:
        assert report(name)['failed'] == 0, name
    assert report('lint-delta.json')['newErrorCount'] == 0
    assert report('build-result.json')['status'] == 'PASS'
    assert report('browser-tests.json')['unexpectedClientErrors'] == 0
    assert report('browser-tests.json')['failed'] == 0
    assert (EVIDENCE / 'typecheck.log').read_text(encoding='utf-8-sig').strip() == ''
    DEST.mkdir(parents=True, exist_ok=True)
    tracked = git('ls-files', '-z').stdout.decode().split('\0')
    added = ['lib/db/environment.ts', 'lib/db/runtime-environment.ts', 'scripts/test-environment-isolation.cjs', 'docs/PERMANENT_ENVIRONMENT_ISOLATION_2026-10-20.md']
    added += [p.relative_to(ROOT).as_posix() for p in (ROOT / 'scripts/stabilization/isolation').iterdir() if p.is_file()]
    files = sorted(set(tracked + added))
    forbidden_dirs = {'output', 'node_modules', '.next', '.open-next', '.git', '.wrangler', '.codex', '.agents', '.aws'}
    source = []
    for name in files:
        if not name or name.split('/')[0] in forbidden_dirs or any(part.startswith('.env') for part in name.split('/')):
            continue
        file = ROOT / name
        if not file.is_file():
            continue
        target = DEST / 'source' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        data = file.read_bytes()
        target.write_bytes(data)
        source.append({'file': name, 'sha256': sha(data)})
    patch = git('diff', '--binary', '--full-index', BASE, '--').stdout
    for name in sorted(set(added)):
        if name not in tracked and (ROOT / name).is_file():
            diff = git('diff', '--no-index', '--binary', '--full-index', '--', '/dev/null', name, check=False)
            assert diff.returncode in (0, 1), name
            patch += diff.stdout
    (DEST / 'permanent-isolation.patch').write_bytes(patch)
    checked = subprocess.run(['git', '-c', 'core.fsmonitor=false', 'apply', '--check', '--reverse', '-'], cwd=ROOT, input=patch, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert checked.returncode == 0, checked.stderr.decode(errors='replace')
    # Verify the complete patch against exact Git blobs without writing .git.
    relative = Path('output/permanent-isolation-20261020') / ('patch-baseline-' + uuid.uuid4().hex[:8])
    scratch = ROOT / relative
    scratch.mkdir()
    changed = git('diff', '--name-only', '--diff-filter=MD', BASE).stdout.decode().splitlines()
    for name in changed:
        target = scratch / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(git('show', BASE + ':' + name).stdout)
    forward = subprocess.run(['git', '-c', 'core.fsmonitor=false', 'apply', '--no-index', '--check', '--directory=' + relative.as_posix(), str(DEST / 'permanent-isolation.patch')], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert forward.returncode == 0, forward.stderr.decode(errors='replace')
    verification = DEST / 'evidence/patch-verification.json'
    verification.parent.mkdir(parents=True, exist_ok=True)
    verification.write_text(json.dumps({'exactBase': BASE, 'patchSha256': sha(patch), 'forwardApplyCheck': 'PASS', 'reverseApplyCheck': 'PASS', 'gitMetadataWrites': 0}, indent=2), encoding='utf-8')
    sqls = []
    old = ROOT / 'output/eskahade-sandbox-recovery-ade5b89b-20261019'
    for file in sorted((ROOT / 'migrations/sandbox-recovery').glob('019[2-5]_*.sql')):
        data = file.read_bytes()
        baseline = git('show', BASE + ':' + file.relative_to(ROOT).as_posix()).stdout
        normalize = lambda b: b.replace(b'\r\n', b'\n')
        assert normalize(data) == normalize(baseline) == normalize((old / 'sandbox-sql' / file.name).read_bytes())
        target = DEST / 'sandbox-sql' / file.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        sqls.append({'file': file.name, 'sourceSha256': sha(data), 'gitLfSha256': sha(normalize(baseline)), 'eolOnlyVerified': True})
    for name in ['recovery-plan.json', 'stage-schema-fingerprints.json', 'mapping-19-columns.json', 'demo-schema-readonly.json', 'demo-migrations-readonly.json', 'demo-counts-readonly.json']:
        src = old / 'evidence' / name
        if not src.is_file():
            src = ROOT / 'output/sandbox-recovery-20261019' / name
        target = DEST / 'recovery-baseline' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
    for name in ['isolation-unit.json', 'config-tests.json', 'background-tests.json', 'maintenance-tests.json', 'http-smoke.json', 'browser-tests.json', 'local-synthetic-receipt.png', 'lint-delta.json', 'build-result.json', 'build-inputs-before.json', 'build-inputs-after.json', 'typecheck.log', 'build-final.log', 'opennext-final.log', 'preview-provenance.json']:
        target = DEST / 'evidence' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(EVIDENCE / name, target)
    shutil.copytree(EVIDENCE / 'regression', DEST / 'evidence/regression', dirs_exist_ok=True, ignore=shutil.ignore_patterns('first-run-results.json'))
    shutil.copyfile(ROOT / 'docs/PERMANENT_ENVIRONMENT_ISOLATION_2026-10-20.md', DEST / 'EXECUTION_RUNBOOK.md')
    manifest = {'createdAtUtc': datetime.now(timezone.utc).isoformat(), 'userDate': '2026-10-20', 'baseCommit': BASE,
                'candidateIdentity': 'baseCommit + patchSha256 + source hashes (uncommitted local patch; no push/merge)',
                'patchSha256': sha(patch), 'source': source, 'sandboxSql': sqls,
                'regression': regression['summary'], 'isolationCases': report('isolation-unit.json')['passed'],
                'http': {k: report('http-smoke.json')[k] for k in ['passed', 'failed']}, 'browser': {'passed': report('browser-tests.json')['passed'], 'unexpectedClientErrors': report('browser-tests.json')['unexpectedClientErrors']},
                'expectedLocalServer5xx': [r for r in report('http-smoke.json')['responses'] if r['status'] >= 500],
                'expectedLocalServer5xxCause': 'Existing bank loader fails closed without BRI credentials on the negative callback test; bank OFF; no credentials added', 'build': 'PASS', 'typecheck': 'PASS', 'newLintErrors': 0,
                'remoteMutations': 0, 'productionDeployed': False, 'sandboxMigrationsExecuted': False, 'sandboxDeployed': False,
                'remoteApprovalsRequired': ['production isolation/legacy-route closure', 'sandbox maintenance/private backup/0192-0195', 'sandbox application deployment/approved synthetic smoke/reopen'],
                'neverRestoreProductionDemoBinding': True, 'historicalMismatch': 'UNRESOLVED_UNTOUCHED; remote 0194 quarantine not installed by this task',
                'bankLiveReady': False, 'exclusions': 'No dotenv/secrets/local database/dependency directory/private remote records/generated deploy bundle. No temporary production reconnect plan.'}
    (DEST / 'release-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    summary = f"""# Permanent isolation — local package

Baseline `{BASE}`, patch SHA256 `{sha(patch)}`.

Production DB-only; demo login/session rejected. Sandbox fixed demo DB only. Scoped staff/parent tokens require one-time re-login. Reset retired. Old preview routes and automatic push deployments closed in source/config. No remote action executed.

Regression: {regression['summary']}. Isolation: {manifest['isolationCases']} PASS. HTTP: {manifest['http']}. Build/typecheck PASS; lint delta zero. Read evidence for local-only fixture/schema limitations and expected negative tests. Full lint backlog is not claimed clean.

Start with EXECUTION_RUNBOOK.md. Production compatibility, old-writer drain, private backup and financial/integrity gates remain mandatory. 0192–0195 are sandbox-only and unchanged except possible EOL bytes. No production DB migration or historical money correction is authorized. Never reconnect production DEMO_DB in cleanup/rollback. Three explicit remote approvals remain.
"""
    (DEST / 'REPORT.md').write_text(summary, encoding='utf-8')
    checks = {p.relative_to(DEST).as_posix(): sha(p.read_bytes()) for p in sorted(DEST.rglob('*')) if p.is_file() and p.name != 'SHA256SUMS.json'}
    (DEST / 'SHA256SUMS.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
    archive = DEST.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for file in sorted(DEST.rglob('*')):
            if file.is_file():
                z.write(file, file.relative_to(DEST).as_posix())
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name, expected in checks.items():
            assert sha(z.read(name)) == expected
    digest = sha(archive.read_bytes())
    archive.with_suffix('.zip.sha256').write_text(digest + '\n', encoding='ascii')
    print(json.dumps({'archive': str(archive), 'sha256': digest, 'files': len(checks), 'forwardPatchCheck': 'PASS', 'reversePatchCheck': 'PASS', 'zipHashCheck': 'PASS'}))

if __name__ == '__main__':
    main()
