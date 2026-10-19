"""Package committed source and an explicit, sanitized evidence allowlist. No network."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'output/stabilization-20261019'
BASE = '6ee5debfb39881aba7bd74b4c3f1058a97210308'
PREVIOUS = 'c8994bbd3fefeac3158138c4543398d3276bad2d'

def git(*args, env=None):
    return subprocess.check_output(['git', '-c', 'core.fsmonitor=false', *args], cwd=ROOT, env=env)

def read(name):
    return json.loads((EVIDENCE / name).read_text(encoding='utf-8-sig'))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    head = git('rev-parse', 'HEAD').decode().strip()
    tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
    changed = git('diff', '--name-only', BASE, head).decode().splitlines()
    dirty_tracked = git('diff', 'HEAD', '--name-only').decode().splitlines()
    if dirty_tracked:
        raise RuntimeError(f'Commit tracked changes first: {dirty_tracked}')
    before, after = read('build-inputs-before.json'), read('build-inputs-after.json')
    assert before['digest'] == after['digest']
    for row in after['files']:
        assert digest((ROOT / row['file']).read_bytes()) == row['sha256'], row['file']
    assert read('build-release-result.json')['exitCode'] == 0
    assert read('regression/results.json')['summary'] == {'passed': 58, 'failed': 0, 'notRun': 4}
    assert read('http-additional.json')['failed'] == 0
    assert read('local-integrity.json')['status'] == 'PASS'
    assert read('lint-delta.json')['newErrorCount'] == 0
    name = f'eskahade-stabilization-release-{head[:8]}-20261019'
    dest = ROOT / 'output' / name
    dest.mkdir(exist_ok=False)

    def copy(src, target):
        target_path = dest / target
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target_path)

    copy(ROOT / 'docs/STABILIZATION_RELEASE_2026-10-19.md', 'REPORT_AND_RUNBOOK.md')
    for file in ['package.json','package-lock.json','wrangler.jsonc','open-next.config.ts']:
        copy(ROOT / file, 'build-config/' + file)
    for file in changed:
        if file.startswith(('app/', 'lib/', 'components/', 'workers/', 'scripts/', 'migrations/', 'docs/')) or file in ['next.config.ts', 'eslint.config.mjs', 'tsconfig.json', 'wrangler.local-test.jsonc']:
            # Git show gives the exact committed content, not untracked local work.
            data = git('show', f'{head}:{file}')
            target = dest / 'changed-source' / file
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    patch = git('diff', '--binary', BASE, head)
    (dest / 'release-from-remediation-baseline.patch').write_bytes(patch)
    (dest / 'incremental-from-previous-release.patch').write_bytes(git('diff', '--binary', PREVIOUS, head))
    # Validate forward against a disposable index, and reverse against HEAD.
    temp_index = EVIDENCE / f'patch-check-{head[:8]}.index'
    if temp_index.exists():
        temp_index.unlink()
    env = dict(os.environ, GIT_INDEX_FILE=str(temp_index))
    git('read-tree', BASE, env=env)
    subprocess.run(['git', '-c', 'core.fsmonitor=false', 'apply', '--cached', '--check', str(dest / 'release-from-remediation-baseline.patch')], cwd=ROOT, env=env, check=True)
    subprocess.run(['git', '-c', 'core.fsmonitor=false', 'apply', '--reverse', '--check', str(dest / 'release-from-remediation-baseline.patch')], cwd=ROOT, check=True)
    temp_index.unlink()

    verification = [
        'd1-native-batch.json','credentials-native.json','http-smoke.json','http-additional.json',
        'local-integrity.json','finance-fixture-evidence.json','local-fixture-provenance.json',
        'build-release-result.json','build-inputs-before.json','build-inputs-after.json',
        'build-release-candidate.log','typecheck-final.log','lint-delta.json',
        'security-final.log','credentials-final.log','report-regression.log',
    ]
    for file in verification:
        copy(EVIDENCE / file, 'verification/' + file)
    for folder in ['regression', 'browser', 'schema-repair-plan']:
        for src in (EVIDENCE / folder).rglob('*'):
            if src.is_file():
                target_root = 'verification' if folder in ['regression', 'browser'] else ''
                copy(src, str(Path(target_root) / folder / src.relative_to(EVIDENCE / folder)))
    for file in ['application-inventory.json','coverage-matrix.csv']:
        copy(EVIDENCE / file, 'coverage/' + file)
    for file in ['production-deployed-current.json','sandbox-deployed-current.json','production-schema-readonly.json','demo-schema-readonly.json','production-migrations-readonly.json','demo-migrations-readonly.json','schema-compatibility.json','invariants-sanitized.json','production-r2-public-readonly.log','production-r2-domains-readonly.log','sandbox-r2-public-readonly.log','sandbox-r2-domains-readonly.log']:
        copy(EVIDENCE / file, 'environment/' + file)
    lint = read('eslint-final.json')
    lint_summary = {'status':'FAIL_EXISTING_BACKLOG', 'files':len(lint), 'errors':sum(r['errorCount'] for r in lint), 'warnings':sum(r['warningCount'] for r in lint), 'delta':read('lint-delta.json')}
    (dest / 'verification/lint-summary.json').write_text(json.dumps(lint_summary, indent=2), encoding='utf-8')
    manifest = {
        'createdAt':datetime.now(timezone.utc).isoformat(), 'commit':head,'gitTree':tree,'branch':git('branch','--show-current').decode().strip(),
        'remediationBaseline':BASE,'previousRelease':PREVIOUS,
        'commits':git('log','--format=%H %s',f'{PREVIOUS}..{head}').decode().splitlines(),
        'LOCAL_CODE_READY':True,'SANDBOX_DEPLOYED_VERIFIED':False,'PRODUCTION_DEPLOYED_VERIFIED':False,
        'scope':'Local stabilized candidate; full lint remains an existing backlog. Remote approval gates remain NO-GO.',
        'bankLiveReady':False,'remoteMutations':0,'deployedGitMapping':'UNVERIFIED',
        'sourceInputDigest':after['digest'],'sourceInputsCount':len(after['files']),
        'build':'PASS','standaloneTypecheck':'PASS','regression':read('regression/results.json')['summary'],
        'httpAdditional':{'passed':read('http-additional.json')['passed'],'failed':0},
        'httpStaticPages':len(read('http-smoke.json')['results']),
        'patchChecks':{'forwardDisposableIndex':'PASS','reverseHEAD':'PASS'},
        'artifactHashes':{'.open-next/worker.js':digest((ROOT / '.open-next/worker.js').read_bytes()),'package-lock.json':digest((ROOT / 'package-lock.json').read_bytes())},
        'excluded':'No .env, secret, production data dump, private discrepancy record, raw deployment authors, local SQLite database or generated deployment bundle. Build from exact Git commit with lockfile.',
        'changedFiles':changed,
    }
    bundle_hashes = {str(p.relative_to(ROOT / '.open-next')).replace('\\','/'):digest(p.read_bytes()) for p in sorted((ROOT / '.open-next').rglob('*')) if p.is_file()}
    (dest / 'verification/build-artifact-hashes.json').write_text(json.dumps(bundle_hashes, indent=2), encoding='utf-8')
    manifest['bundleTreeDigest'] = digest(json.dumps(bundle_hashes, sort_keys=True).encode())
    (dest / 'release-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    hashes = {str(p.relative_to(dest)).replace('\\','/'):digest(p.read_bytes()) for p in sorted(dest.rglob('*')) if p.is_file()}
    (dest / 'SHA256SUMS.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
    archive = dest.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(dest.rglob('*')):
            if p.is_file():
                z.write(p, name + '/' + str(p.relative_to(dest)))
    checksum = digest(archive.read_bytes())
    archive.with_suffix('.zip.sha256').write_text(checksum + '  ' + archive.name + '\n', encoding='ascii')
    delivery = {'directory':str(dest),'zip':str(archive),'sha256':checksum,'commit':head,'entries':len(hashes)+1}
    (EVIDENCE / 'delivery.json').write_text(json.dumps(delivery, indent=2), encoding='utf-8')
    print(json.dumps(delivery, indent=2))

if __name__ == '__main__':
    main()
