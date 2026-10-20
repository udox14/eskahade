// Production-only boundary for the exact deployed artifact. Claims can deny,
// never grant, authentication; the original HMAC verification remains required.
function __eskIsolationDemo(value) {
  return value?.role === 'demo' || value?.demoSandbox === true ||
    (Array.isArray(value?.roles) && value.roles.includes('demo'));
}
function __eskIsolationClaims(value) {
  return !!value && value.environment === 'production' && !__eskIsolationDemo(value);
}
function __eskIsolationRow(row) {
  if (!row) return null;
  let roles = [];
  try { roles = row.roles ? JSON.parse(row.roles) : []; } catch { return null; }
  if (!Array.isArray(roles) || __eskIsolationDemo({ role: row.role, roles })) return null;
  return row.role || roles.length ? row : null;
}
function __eskIsolationMint(payload) {
  if (__eskIsolationDemo(payload) || (payload.environment && payload.environment !== 'production')) throw Error('Sesi tidak diizinkan.');
  return { ...payload, environment: 'production' };
}
function __eskIsolationDecode(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch { return null; }
}
async function __eskIsolationFetch(request, env, ctx, delegate) {
  if (!env.DB || 'DEMO_DB' in env) return new Response('Konfigurasi database tidak tersedia.', { status:503, headers:{'Cache-Control':'no-store'} });
  const path = new URL(request.url).pathname.replace(/\/+$/,'') || '/';
  if (['/api/demo/reset','/api/migrate','/api/update-db'].includes(path)) return new Response('Endpoint retired.',{status:410,headers:{'Cache-Control':'no-store'}});
  const pairs=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(Boolean);
  let deniedStaff=false,deniedParent=false;
  const kept=pairs.filter(pair=>{
    const cut=pair.indexOf('='),name=pair.slice(0,cut),token=pair.slice(cut+1);
    if (!['eskahade_session','eskahade_portal_session'].includes(name)) return true;
    if (__eskIsolationClaims(__eskIsolationDecode(token))) return true;
    if(name==='eskahade_session')deniedStaff=true;else deniedParent=true;
    return false;
  });
  if(deniedStaff && path.startsWith('/dashboard')) return Response.redirect(new URL('/login',request.url),307);
  if(deniedParent && path.startsWith('/portal-ortu') && path!=='/portal-ortu/login') return Response.redirect(new URL('/portal-ortu/login',request.url),307);
  // Invalid/old staff cookies cannot select a DB during fresh parent/staff login.
  if(kept.length!==pairs.length){const headers=new Headers(request.headers);headers.set('cookie',kept.join('; '));request=new Request(request,{headers});}
  return delegate(request,env,ctx);
}
