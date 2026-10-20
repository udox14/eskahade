/* eslint-disable @typescript-eslint/no-require-imports -- Locate every compiled auth copy, including server-action variant. */
function authModules(text){
 const headers=[...text.matchAll(/(?:module\.exports = \[|\}, )(\d+), \((\w+)\) => \{/g)],out=[];
 for(const marker of text.matchAll(/hydrateSessionFromDb ERROR|__ESK_HYDRATION_FAIL_CLOSED__/g)){
  const header=headers.findLast(x=>x.index+x[0].length<marker.index);if(!header)throw Error('Auth module header missing');
  const start=header.index+header[0].length,tail=text.slice(marker.index),endMatch=tail.match(/\n\s*\w+\.s\(\[[^\n]*"getSession"[^\n]*\);/);if(!endMatch)throw Error('Auth export table missing');
  const end=marker.index+endMatch.index+endMatch[0].length;
  out.push({start,end,body:text.slice(start,end),alias:header[2],id:header[1]});
 }
 return out;
}
module.exports={authModules};
