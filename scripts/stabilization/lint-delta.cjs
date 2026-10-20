/* eslint-disable @typescript-eslint/no-require-imports -- Compare source diagnostics without changing the Git checkout. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
async function main(){
  const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.ESKAHADE_EVIDENCE_DIR||'output/stabilization-20261019');
  const {ESLint}=await import('eslint'),eslint=new ESLint({cwd:root});
  const git=args=>execFileSync('git',['-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8'}).trim();
  const baselineCommit=process.env.ESKAHADE_LINT_BASELINE||'c8994bbd3fefeac3158138c4543398d3276bad2d';
  if(!/^[a-f0-9]{40}$/.test(baselineCommit))throw Error('Exact baseline commit required');
  const changed=git(['diff',baselineCommit,'--name-only']).split('\n').filter(f=>/\.[cm]?[jt]sx?$/.test(f));
  const added=git(['ls-files','--others','--exclude-standard','scripts/stabilization','scripts/test-environment-isolation.cjs','lib/db/environment.ts','lib/db/runtime-environment.ts','scripts/test-sandbox-recovery.cjs','scripts/test-dataset-cache.cjs','lib/cache/dataset-cache.ts','lib/db/cache-context.ts','app/dashboard/guru/page.tsx','scripts/test-stabilization-security.cjs','scripts/test-stabilization-credentials.cjs','scripts/test-stabilization-reports.cjs','lib/finance/date-format.ts']).split('\n').filter(f=>/\.[cm]?[jt]sx?$/.test(f));
  const counts=results=>{const rows={};for(const m of results.flatMap(r=>r.messages).filter(m=>m.severity===2))rows[m.ruleId||'parse']=(rows[m.ruleId||'parse']||0)+1;return rows;};
  const files=[];
  for(const file of [...new Set([...changed,...added])]){
    if(!fs.existsSync(path.join(root,file)))continue; // Deleted source has no current diagnostics.
    const current=counts(await eslint.lintText(fs.readFileSync(path.join(root,file),'utf8'),{filePath:path.join(root,file)}));
    let baseline={};
    if(git(['ls-tree','--name-only',baselineCommit,'--',file]))baseline=counts(await eslint.lintText(git(['show',baselineCommit+':'+file]),{filePath:path.join(root,file)}));
    const regressions=Object.entries(current).filter(([rule,n])=>n>(baseline[rule]||0)).map(([rule,n])=>({rule,added:n-(baseline[rule]||0)}));
    files.push({file,baseline,current,regressions});
  }
  const result={generatedAt:new Date().toISOString(),baselineCommit,fullRepositoryLint:'FAIL_LEGACY_BACKLOG',files,newErrorCount:files.flatMap(f=>f.regressions).reduce((n,r)=>n+r.added,0)};
  fs.writeFileSync(path.join(out,'lint-delta.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({files:files.length,newErrorCount:result.newErrorCount,regressions:files.filter(f=>f.regressions.length)}));
  if(result.newErrorCount)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
