"""One consolidated local release package. Verifies evidence; performs no remote action."""
from pathlib import Path
import json, hashlib, subprocess, shutil, difflib, zipfile, uuid
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[3]
E=ROOT/'output/autonomous-delivery-20261020'
D=ROOT/'output/eskahade-consolidated-delivery-20261020'
BASE='ade5b89b837a82fe824f9f61aff055d50f893674'
def sha(b):return hashlib.sha256(b).hexdigest()
def read(name):return json.loads((E/name).read_text(encoding='utf-8-sig'))
def git(*args,check=True):return subprocess.run(['git','-c','core.fsmonitor=false','-c','core.quotepath=false',*args],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=check)
def main():
    assert git('rev-parse','HEAD').stdout.decode().strip()==BASE
    regression=read('regression/results.json');assert regression['summary']['failed']==0
    for name in ['hotfix-tests.json','hotfix-http.json','hotfix-browser.json','http-smoke.json','combined-browser.json','final-native-postflight.json','native-d1-recovery.json','d1-native-batch.json','credentials-native.json','config-tests.json','background-tests.json','maintenance-concurrency.json']:
        assert read(name)['failed']==0,name
    assert read('lint-delta.json')['newErrorCount']==0
    assert read('build-result.json')['status']=='PASS'
    assert not (E/'typecheck.log').read_text(encoding='utf-8-sig').strip()
    assert read('hotfix-browser.json')['unexpectedClientErrors']==0
    assert read('combined-browser.json')['unexpectedClientErrors']==0
    D.mkdir(parents=True,exist_ok=True)
    tracked=git('ls-files','-z').stdout.decode().split('\0')
    added=['lib/db/environment.ts','lib/db/runtime-environment.ts','scripts/test-environment-isolation.cjs','docs/PERMANENT_ENVIRONMENT_ISOLATION_2026-10-20.md','docs/CONSOLIDATED_DELIVERY_2026-10-20.md','scripts/stabilization/detachment-preflight.cjs','scripts/stabilization/record-detachment-stop.cjs']
    for folder in ['scripts/stabilization/delivery','scripts/stabilization/isolation']:
        added += [p.relative_to(ROOT).as_posix() for p in (ROOT/folder).iterdir() if p.is_file() and p.suffix!='.pyc']
    files=sorted(set(tracked+added));source=[]
    forbidden={'output','node_modules','.next','.open-next','.git','.wrangler','.codex','.agents','.aws'}
    for name in files:
        if not name or name.split('/')[0] in forbidden or any(x.startswith('.env') or x.startswith('.dev.vars') for x in name.split('/')):continue
        p=ROOT/name
        if not p.is_file():continue
        data=p.read_bytes();target=D/'source'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);source.append({'file':name,'sha256':sha(data)})
    patch=git('diff','--binary','--full-index',BASE,'--').stdout
    for name in sorted(set(added)):
        if name not in tracked:
            r=git('diff','--no-index','--binary','--full-index','--','/dev/null',name,check=False);assert r.returncode in (0,1),name;patch+=r.stdout
    (D/'integrated-source.patch').write_bytes(patch)
    check=subprocess.run(['git','-c','core.fsmonitor=false','apply','--check','--reverse','-'],input=patch,cwd=ROOT,capture_output=True);assert check.returncode==0,check.stderr
    relative=Path('output/autonomous-delivery-20261020')/('patch-baseline-'+uuid.uuid4().hex[:8]);scratch=ROOT/relative;scratch.mkdir()
    for name in git('diff','--name-only','--diff-filter=MD',BASE).stdout.decode().splitlines():
        p=scratch/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git('show',BASE+':'+name).stdout)
    check=git('apply','--no-index','--check','--directory='+relative.as_posix(),str(D/'integrated-source.patch'),check=False);assert check.returncode==0,check.stderr
    hot=E/'production-hotfix';hotManifest=read('production-hotfix/manifest.json')
    hotSource=(hot/'worker.js').read_bytes();old=(hot/'baseline-worker.js').read_bytes()
    assert sha(hotSource)==hotManifest['hotfixSha256'] and sha(old)==hotManifest['baselineSha256']
    # Reject actual private-key material, not source-code validators naming PEM markers.
    assert b'-----BEGIN PRIVATE KEY-----\nM' not in hotSource and b'-----BEGIN RSA PRIVATE KEY-----\nM' not in hotSource
    target=D/'production-hotfix';target.mkdir(exist_ok=True)
    for name in ['worker.js','baseline-worker.js','baseline-settings.json','manifest.json','upload-metadata.json']:shutil.copyfile(hot/name,target/name)
    artifactPatch=''.join(difflib.unified_diff(old.decode().splitlines(keepends=True),hotSource.decode().splitlines(keepends=True),fromfile='a/worker.js',tofile='b/worker.js'))
    (target/'production-hotfix.patch').write_text(artifactPatch,encoding='utf-8',newline='\n')
    hpdir=ROOT/relative/'hotfix';hpdir.mkdir();(hpdir/'worker.js').write_bytes(old)
    hcheck=git('apply','--no-index','--check','--directory='+(relative/'hotfix').as_posix(),str(target/'production-hotfix.patch'),check=False);assert hcheck.returncode==0,hcheck.stderr
    sql=[]
    selected=list((ROOT/'migrations').glob('018[7-9]_*.sql'))+list((ROOT/'migrations').glob('0190_*.sql'))+list((ROOT/'migrations/sandbox-recovery').glob('019[2-5]_*.sql'))
    assert len(selected)==8
    for p in sorted(selected):
        data=p.read_bytes();original=git('show',BASE+':'+p.relative_to(ROOT).as_posix()).stdout
        assert data.replace(b'\r\n',b'\n')==original.replace(b'\r\n',b'\n'),p
        lane='sandbox-0192-0195' if p.parent.name=='sandbox-recovery' else 'production-0187-0190'
        dest=D/'sql'/lane/p.name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);sql.append({'file':p.name,'target':lane,'sha256':sha(data),'gitLfSha256':sha(original.replace(b'\r\n',b'\n')),'unchangedSubstantiveSql':True})
    # Current evidence only. Failed attempts are retained under explicit names.
    evidenceFiles=['hotfix-tests.json','hotfix-http.json','hotfix-browser.json','hotfix-browser.png','http-smoke.json','combined-browser.json','combined-browser.png','final-native-postflight.json','native-d1-recovery.json','d1-native-batch.json','credentials-native.json','config-tests.json','background-tests.json','maintenance-concurrency.json','lint-delta.json','build-result.json','build-inputs-before.json','build-inputs-after.json','typecheck.log','build.log','traces-complete.log','generate-complete.log','opennext-complete.log','trace-repair.json','hotfix-fixture.json','local-fixture-provenance.json','delivery-journal.json','production-schema-current.json','http-packaging-failure.json','http-partial-trace-failure.json']
    (D/'evidence').mkdir(exist_ok=True)
    for name in evidenceFiles:shutil.copyfile(E/name,D/'evidence'/name)
    shutil.copytree(E/'regression',D/'evidence/regression',dirs_exist_ok=True)
    # Schema-only and published configuration baseline for reproducible synthetic rehearsals.
    for folder,names in [('output/stabilization-20261019',['production-schema-readonly.json','production-feature-config-readonly.json','application-inventory.json']),('output/sandbox-recovery-20261019',['recovery-plan.json','stage-schema-fingerprints.json','mapping-19-columns.json','demo-schema-readonly.json','demo-migrations-readonly.json','demo-counts-readonly.json'])]:
        for name in names:
            dest=D/'rehearsal-baselines'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/folder/name,dest)
    shutil.copyfile(ROOT/'docs/CONSOLIDATED_DELIVERY_2026-10-20.md',D/'START_HERE.md')
    manifest={'createdAt':datetime.now(timezone.utc).isoformat(),'userDate':'2026-10-20','integratedBaseCommit':BASE,'integratedPatchSha256':sha(patch),'source':source,'hotfix':hotManifest,'sql':sql,'verification':{'regression':regression['summary'],'hotfix':read('hotfix-tests.json')['passed'],'hotfixHttp':read('hotfix-http.json')['passed'],'hotfixBrowser':read('hotfix-browser.json')['passed'],'combinedHttp':read('http-smoke.json')['passed'],'combinedBrowser':read('combined-browser.json')['passed'],'nativeFinancial':read('d1-native-batch.json')['passed'],'nativeCredential':read('credentials-native.json')['passed'],'nativeRecovery':read('native-d1-recovery.json')['passed'],'concurrentMaintenance':60,'typecheck':'PASS','build':'PASS','newLintErrors':0,'patchForwardReverse':'PASS','hotfixPatchForward':'PASS'},'remoteMutations':0,'productionDemoDbDetached':False,'productionDeployed':False,'sandboxMigrationsApplied':False,'sandboxDeployed':False,'localGo':'GO_FOR_OWNER_REVIEW','productionHotfixRemoteGo':'NO_GO: fresh schema query denied7403 + deployment/preview approval/live smoke pending','productionFullRemoteGo':'NO_GO: all production writers freeze/drain, private backup,0187-0190,R2/deploy/smoke approvals pending','sandboxRemoteGo':'NO_GO: detachment/drain,backup,0192-0195,deployment/synthetic smoke approvals pending','briQlolaLiveGo':'NO_GO: contract/UAT/activation external','historicalDemoMismatch':'UNRESOLVED_UNTOUCHED; quarantine remote not installed by this task','neverRestoreProductionDemoBinding':True,'excluded':'No dotenv, credentials, local DB/persistence, private raw management settings, customer rows, static asset fetch cache or dependency folders'}
    (D/'release-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    summary=f"""# Consolidated delivery result\n\nLocal package ready for owner review. No remote mutation.\n\nExact integrated source: {BASE} + patch SHA256 {sha(patch)}. Exact production hotfix derives from active compiled artifact, with separate hashes and six auth copies patched; it needs no production migration.\n\nVerification: {json.dumps(manifest['verification'])}. Read logs for failed build-packaging attempts and corrections, not only final pass counts. Four regression exclusions remain explicit.\n\nProduction hotfix/full production/sandbox/BRI live: REMOTE NO-GO until the distinct gates in START_HERE.md pass. Latest production schema read denied7403. Historical snapshot compatibility is not current remote validation. Known demo discrepancy remains untouched. No automatic rollback/reconnect/restore.\n\nBegin with START_HERE.md and verify-package.py. Detailed issue journal and self-review: evidence/delivery-journal.json.\n"""
    (D/'FINAL_REPORT.md').write_text(summary,encoding='utf-8')
    verifier='''from pathlib import Path\nimport hashlib,json\nr=Path(__file__).resolve().parent\nfor name,want in json.loads((r/'SHA256SUMS.json').read_text()).items():\n p=(r/name).resolve(); assert r in p.parents; assert hashlib.sha256(p.read_bytes()).hexdigest()==want,name\nprint('PASS package hashes; no remote action performed')\n'''
    (D/'verify-package.py').write_text(verifier,encoding='utf-8')
    checks={p.relative_to(D).as_posix():sha(p.read_bytes()) for p in sorted(D.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
    (D/'SHA256SUMS.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
    z=D.with_suffix('.zip')
    with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as a:
        for p in sorted(D.rglob('*')):
            if p.is_file():a.write(p,p.relative_to(D).as_posix())
    with zipfile.ZipFile(z) as a:
        assert a.testzip() is None
        for name,want in checks.items():assert sha(a.read(name))==want,name
    digest=sha(z.read_bytes());z.with_suffix('.zip.sha256').write_text(digest+'\n',encoding='ascii')
    print(json.dumps({'archive':str(z),'sha256':digest,'files':len(checks),'sourcePatch':sha(patch),'hotfixPatch':sha(artifactPatch.encode()),'verification':manifest['verification']}))
if __name__=='__main__':main()
