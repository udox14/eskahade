"""One local, immutable recovery release. Explicit evidence allowlists; no network."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/sandbox-recovery-20261019'
PRIOR = ROOT / 'output/stabilization-20261019'
BASE = '031e7f3d5878ba81beab443f8d58554af74d2af2'
REMEDIATION = '6ee5debfb39881aba7bd74b4c3f1058a97210308'

def git(*args, env=None):
    return subprocess.check_output(['git','-c','core.fsmonitor=false',*args],cwd=ROOT,env=env)

def load(name):
    return json.loads((OUT / name).read_text(encoding='utf-8-sig'))

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    commit = git('rev-parse','HEAD').decode().strip()
    assert not git('diff','HEAD','--name-only').strip(), 'Commit tracked changes first'
    before, after = load('build-inputs-before.json'), load('build-inputs-after.json')
    assert before['digest'] == after['digest']
    for row in after['files']:
        assert sha((ROOT / row['file']).read_bytes()) == row['sha256'], row['file']
    assert load('build-result.json')['exitCode'] == 0
    assert (OUT / 'typecheck-exit.txt').read_text(encoding='utf-8-sig').strip() == '0'
    assert load('lint-delta.json')['newErrorCount'] == 0
    assert load('regression/results.json')['summary'] == {'passed':60,'failed':0,'notRun':4}
    assert load('migration-rehearsal.json')['passed'] == 13
    assert load('native-d1-recovery.json')['passed'] == 16
    assert load('native-postflight.json')['schemaFingerprintNativeAndOfflineMatch']
    assert load('runtime-integrity.json')['status'] == 'PASS'
    assert load('http-additional.json')['passed'] == 60 and load('http-additional.json')['failed'] == 0
    assert all(r['result']=='PASS_SSR' for r in load('http-smoke.json')['results'])
    assert all(r['status']=='PASS' for r in load('browser/results.json')['cases'])
    name = f'eskahade-sandbox-recovery-{commit[:8]}-20261019'
    dest = ROOT / 'output' / name
    dest.mkdir(exist_ok=False)

    def copy(src, target):
        target = dest / target
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(src,target)

    copy(ROOT / 'docs/SANDBOX_RECOVERY_RELEASE_2026-10-19.md','REPORT_AND_EXECUTION_CHECKLIST.md')
    changed = git('diff','--name-only',REMEDIATION,commit).decode().splitlines()
    for file in changed:
        target = dest / 'changed-source' / file
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(git('show',f'{commit}:{file}'))
    for file in ['package.json','package-lock.json','wrangler.jsonc','wrangler.local-test.jsonc','open-next.config.ts']:
        copy(ROOT / file,'build-config/' + file)
    for stage in load('recovery-plan.json')['stages']:
        src = ROOT / 'migrations/sandbox-recovery' / stage['file']
        assert sha(src.read_bytes()) == stage['sha256']
        copy(src,'sandbox-sql/' + stage['file'])
    for file in ['0187_finance_controlled_remediation.sql','0188_bri_evidence_guards.sql','0189_finance_snapshot_and_reporting.sql','0190_retire_removed_finance_sidebar.sql']:
        copy(ROOT / 'migrations' / file,'production-pending-sql/' + file)
    for src in (ROOT / 'scripts/stabilization/recovery-data').glob('*.sql'):
        copy(src,'data-repair-review/' + src.name)
    required = [
        'demo-schema-readonly.json','demo-migrations-readonly.json','demo-counts-readonly.json','demo-roles-readonly.json',
        'demo-features-readonly.json','demo-permissions-readonly.json','recovery-plan.json','mapping-19-columns.json',
        'stage-schema-fingerprints.json','repaired-schema.json','baseline-preflight.log',
        'migration-rehearsal.json','migration-rehearsal.log','native-d1-recovery.json','native-postflight.json',
        'runtime-integrity.json','http-smoke.json','http-additional.json','build-inputs-before.json','build-inputs-after.json',
        'build-result.json','build-cloudflare.log','typecheck.log','typecheck-exit.txt','lint-delta.json',
    ]
    for file in required:
        copy(OUT / file,'evidence/' + file)
    for folder in ['regression','browser']:
        for src in (OUT / folder).rglob('*'):
            if src.is_file() and not src.name.startswith('before-'):
                copy(src,'evidence/' + folder + '/' + str(src.relative_to(OUT / folder)))
    # Reproduction inputs contain schema/config metadata only. No user rows,
    # remote transaction dump, password hash, .env or private discrepancy file.
    for file in ['application-inventory.json','local-final-schema.json','production-feature-config-readonly.json','schema-repair-plan/sandbox-plan.json']:
        copy(PRIOR / file,'repro-inputs/output/stabilization-20261019/' + file)
    for file in ['production-schema-readonly.json','production-migrations-readonly.json','production-deployed-current.json','sandbox-deployed-current.json','production-r2-public-readonly.log','production-r2-domains-readonly.log','sandbox-r2-public-readonly.log','sandbox-r2-domains-readonly.log','invariants-sanitized.json']:
        copy(PRIOR / file,'baseline-environment-20261019/' + file)
    copy(ROOT / 'docs/STABILIZATION_RELEASE_2026-10-19.md','baseline-environment-20261019/PRIOR_RUNBOOK.md')
    (dest / 'incremental-from-stabilization.patch').write_bytes(git('diff','--binary',BASE,commit))
    full_patch = dest / 'release-from-remediation-baseline.patch'
    full_patch.write_bytes(git('diff','--binary',REMEDIATION,commit))
    index = OUT / f'patch-check-{commit[:8]}.index'
    assert not index.exists()
    env = dict(os.environ,GIT_INDEX_FILE=str(index))
    git('read-tree',REMEDIATION,env=env)
    for args, environment in [(['apply','--cached','--check',str(full_patch)],env),(['apply','--reverse','--check',str(full_patch)],None)]:
        subprocess.run(['git','-c','core.fsmonitor=false',*args],cwd=ROOT,env=environment,check=True)
    index.unlink()
    bundle = {str(p.relative_to(ROOT / '.open-next')).replace('\\','/'):sha(p.read_bytes()) for p in sorted((ROOT / '.open-next').rglob('*')) if p.is_file()}
    (dest / 'evidence/build-artifact-hashes.json').write_text(json.dumps(bundle,indent=2),encoding='utf-8')
    manifest = {
        'createdAt':datetime.now(timezone.utc).isoformat(),'commit':commit,'gitTree':git('rev-parse','HEAD^{tree}').decode().strip(),
        'baselineCommit':BASE,'remediationBaseline':REMEDIATION,'sourceInputDigest':after['digest'],'sourceInputCount':len(after['files']),
        'bundleTreeDigest':sha(json.dumps(bundle,sort_keys=True).encode()),
        'LOCAL_SANDBOX_REPAIR_READY':True,
        'SANDBOX_REMOTE_REPAIR_PENDING_APPROVAL':True,
        'SANDBOX_DEPLOY_PENDING_APPROVAL':True,
        'PRODUCTION_RELEASE_PENDING_APPROVAL':True,
        'SANDBOX_DEPLOYED_VERIFIED':False,'PRODUCTION_DEPLOYED_VERIFIED':False,'remoteMutations':0,'bankLiveReady':False,
        'regression':load('regression/results.json')['summary'],
        'migrationCases':13,'nativeD1Cases':16,'nativeCoreTableQuickChecks':7,'nativeWholeDatabaseQuickCheck':'UNAVAILABLE_SQLITE_NOMEM',
        'offlineWholeDatabaseIntegrity':'PASS','httpStaticPages':len(load('http-smoke.json')['results']),'httpAdditional':60,
        'build':'PASS','standaloneTypecheck':'PASS','lintDeltaNewErrors':0,'fullLint':'Existing baseline backlog remains FAIL; not relabeled clean',
        'sandboxTablesAdded':78,'deliberatelyDeferredLegacyTables':2,'columnsAdded':40,'financeMappings':19,
        'knownDemoConservationCase':'UNRESOLVED; new distributions quarantined, old money/inflight reservations preserved',
        'patchChecks':{'forwardDisposableIndex':'PASS','reverseHEAD':'PASS'},
        'operatorApprovals':'See REPORT_AND_EXECUTION_CHECKLIST.md; sandbox and production separated; no implicit execution approval.',
        'deployedGitMapping':'UNVERIFIED; baseline deployment metadata is dated historical evidence, not this release.',
        'sourceChanges':git('diff','--name-only',BASE,commit).decode().splitlines(),
        'excluded':'No .env, credentials, local DB, remote row export, private mismatch record or generated deploy bundle. Rebuild exact commit with lockfile.',
    }
    (dest / 'release-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    hashes={str(p.relative_to(dest)).replace('\\','/'):sha(p.read_bytes()) for p in sorted(dest.rglob('*')) if p.is_file()}
    (dest / 'SHA256SUMS.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
    archive=dest.with_suffix('.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(dest.rglob('*')):
            if p.is_file(): z.write(p,name+'/'+str(p.relative_to(dest)))
    checksum=sha(archive.read_bytes())
    archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='ascii')
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for file, expected in hashes.items(): assert sha(z.read(name+'/'+file)) == expected
        assert not any(Path(p).name.startswith('.env') or p.endswith(('.sqlite','.sqlite3','.pem','.key')) or 'discrepancy-review-private' in p for p in z.namelist())
    delivery={'zip':str(archive),'directory':str(dest),'commit':commit,'sha256':checksum,'entries':len(hashes)+1,'zipCrcAndManifestHashes':'PASS'}
    (OUT / 'delivery.json').write_text(json.dumps(delivery,indent=2),encoding='utf-8')
    print(json.dumps(delivery,indent=2))

if __name__ == '__main__':
    main()
