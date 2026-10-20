/* eslint-disable @typescript-eslint/no-require-imports -- Resume installed Next tracing after interrupted successful compile; local build only. */
const path=require('node:path'),fs=require('node:fs');
async function main(){
 const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'.next');
 if(!fs.existsSync(path.join(dir,'BUILD_ID')))throw Error('Compiled Next output missing');
 const loadConfig=require('next/dist/server/config').default,{PHASE_PRODUCTION_BUILD}=require('next/constants');
 const config=await loadConfig(PHASE_PRODUCTION_BUILD,root);
 const {collectBuildTraces}=require('next/dist/build/collect-build-traces');
 const server=path.join(dir,'server'),entryNameFilesMap={},inputs=new Set();
 function entries(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isDirectory())entries(file);else if(item.name.endsWith('.js.nft.json')){const name=path.relative(server,file).replaceAll('\\','/').replace(/\.js\.nft\.json$/,'');if(!name.startsWith('app/')&&!name.startsWith('pages/'))continue;const trace=JSON.parse(fs.readFileSync(file));const files=[file.slice(0,-9),...trace.files.map(f=>path.resolve(path.dirname(file),f))].filter(f=>fs.existsSync(f)&&/\.[cm]?js$/.test(f));entryNameFilesMap[name]=files;for(const f of files)inputs.add(f);}}}
 entries(server);if(Object.keys(entryNameFilesMap).length<100)throw Error('Incomplete compiled route map');
 await collectBuildTraces({dir:root,config,distDir:dir,edgeRuntimeRoutes:{},staticPages:[],outputFileTracingRoot:root,buildTraceContext:{chunksTrace:{action:{input:[...inputs]},entryNameFilesMap}}});
 // A resumed collector lacks webpack's in-memory entryNameFilesMap. Explicitly
 // retain Next's real CommonJS boundary in every recovered file trace, so the
 // standalone/OpenNext copies preserve the module semantics of compiled chunks.
 const marker=path.join(dir,'package.json');if(JSON.parse(fs.readFileSync(marker)).type!=='commonjs')throw Error('Unexpected Next module boundary');
 let repaired=0;
 function walk(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){if(item.name==='standalone'||item.name==='cache')continue;const file=path.join(folder,item.name);if(item.isDirectory())walk(file);else if(item.name.endsWith('.nft.json')){const trace=JSON.parse(fs.readFileSync(file));const relative=path.relative(path.dirname(file),marker).replaceAll('\\','/');if(!trace.files.includes(relative)){trace.files.push(relative);fs.writeFileSync(file,JSON.stringify(trace));repaired++;}}}}
 walk(dir);fs.writeFileSync(path.join(root,'output/autonomous-delivery-20261020/trace-repair.json'),JSON.stringify({scope:'Build trace dependency only; compiled JS unchanged',commonJsBoundary:'.next/package.json',repairedTraces:repaired,reason:'Resumed collector has no webpack entryNameFilesMap; preserve existing compiled module semantics',remoteActions:0},null,2));
 console.log('PASS installed Next collector completed build traces; generation/standalone still required');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
