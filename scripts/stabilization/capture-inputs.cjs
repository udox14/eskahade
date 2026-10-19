/* eslint-disable @typescript-eslint/no-require-imports -- Pin local build inputs without collecting environment secrets. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/stabilization-20261019');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=[...['app','lib','components','public','workers','migrations'].flatMap(d=>walk(path.join(root,d))),...['package.json','package-lock.json','next.config.ts','open-next.config.ts','wrangler.jsonc','tsconfig.json','cloudflare-env.d.ts'].map(f=>path.join(root,f))];
const rows=files.sort().map(file=>({file:path.relative(root,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const digest=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const name=process.argv[2]||'build-inputs';
if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid evidence name');
fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({capturedAt:new Date().toISOString(),digest,files:rows},null,2));
console.log(name+': '+rows.length+' inputs, SHA256 '+digest);
