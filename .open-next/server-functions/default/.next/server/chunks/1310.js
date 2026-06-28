exports.id=1310,exports.ids=[1310],exports.modules={1501:(a,b,c)=>{"use strict";c.d(b,{cK:()=>g,n:()=>i});var d=c(23755),e=c(48445),f=c(55743);async function g(a,b){if(!a)return!1;if((0,d.qc)(a))return!0;let c=(0,d.XV)(a);if(0===c.length)return!1;try{return await (0,e.kO)(b,c,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",b,"-",a?.message),!1}}async function h(a,b,c="read"){return"read"===c?g(a,b):(0,f.Yf)(a,b,c)}async function i(a,b="read"){let c=await (0,d.Ht)();return c?await h(c,a,b)?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},23318:(a,b,c)=>{let{createProxy:d}=c(78830);a.exports=d("C:\\DATA\\eskahade\\node_modules\\next\\dist\\client\\app-dir\\link.js")},24424:(a,b)=>{"use strict";function c(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(b,"D",{enumerable:!0,get:function(){return c}})},29791:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(52862).A)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]])},30236:(a,b,c)=>{"use strict";c.d(b,{CF:()=>k,DS:()=>p,Mx:()=>q,NL:()=>m,Pu:()=>o,bO:()=>r});var d=c(65573),e=c(44075);let f=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),g=null,h=new Map;function i(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function j(a){return null==a?null:"string"==typeof a?i(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(j):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!f.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,j(b)])):String(a)}function k(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function l(){try{let a=await (0,d.b3)(),b=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(b?b.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function m(){g||(g=(async()=>{await (0,e.g7)(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id            TEXT PRIMARY KEY,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          actor_name    TEXT,
          actor_roles   TEXT,
          module        TEXT NOT NULL,
          action        TEXT NOT NULL,
          entity_type   TEXT,
          entity_id     TEXT,
          entity_label  TEXT,
          summary       TEXT NOT NULL,
          details_json  TEXT,
          status        TEXT NOT NULL DEFAULT 'success',
          ip_address    TEXT,
          user_agent    TEXT
        )
      `),await (0,e.g7)(`
        CREATE TABLE IF NOT EXISTS activity_log_config (
          fitur_href   TEXT PRIMARY KEY,
          group_name   TEXT NOT NULL,
          title        TEXT NOT NULL,
          log_create   INTEGER NOT NULL DEFAULT 1,
          log_update   INTEGER NOT NULL DEFAULT 1,
          log_delete   INTEGER NOT NULL DEFAULT 1,
          updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
        )
      `),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)"),await (0,e.g7)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)");try{await (0,e.g7)(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `),await (0,e.g7)(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)}catch{}})().catch(a=>{throw g=null,a})),await g}async function n(a,b){if(!a||!b)return!0;let c=`${a}:${b}`,d=h.get(c);if(d&&d.expiresAt>Date.now())return d.values[b];await m();let f=await (0,e.Zy)(`SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]),g=f?{create:1===f.log_create,update:1===f.log_update,delete:1===f.log_delete}:{create:!0,update:!0,delete:!0},i=Date.now()+6e4;return h.set(`${a}:create`,{expiresAt:i,values:g}),h.set(`${a}:update`,{expiresAt:i,values:g}),h.set(`${a}:delete`,{expiresAt:i,values:g}),g[b]}async function o(){return await m(),(0,e.P)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`)}async function p(a,b,c){await m();let d=await (0,e.Zy)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]);if(!d)throw Error("Konfigurasi log fitur tidak ditemukan.");let f={create:b.create??1===d.log_create,update:b.update??1===d.log_update,delete:b.delete??1===d.log_delete};await (0,e.g7)(`UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,[+!!f.create,+!!f.update,+!!f.delete,c,a]);let g=Date.now()+6e4,i={create:f.create,update:f.update,delete:f.delete};h.set(`${a}:create`,{expiresAt:g,values:i}),h.set(`${a}:update`,{expiresAt:g,values:i}),h.set(`${a}:delete`,{expiresAt:g,values:i})}async function q(a){try{var b,c;if(await m(),!await n(a.fiturHref,a.logKind))return;let d=a.requestInfo??await l(),f=a.actor??null;await (0,e.g7)(`INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,e.$C)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,i(a.summary,300),!(c=a.details)?null:JSON.stringify(j(c)),a.status??"success",d.ipAddress??null,d.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function r(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:j(c),after:j(f)})}return d}},45502:(a,b,c)=>{"use strict";c.d(b,{F:()=>g,S:()=>h});var d=c(23755),e=c(1501),f=c(91970);async function g(a){let b=await (0,d.Ht)();b||(0,f.redirect)("/login");let c=(0,d.XV)(b);if(c.includes("admin"))return b;let g=!1;try{g=await (0,e.cK)(b,a)}catch(c){return console.error("[guard] canAccessHref ERROR untuk",a,"-",c?.message),console.error("[guard] PERINGATAN: pastikan migration 0011_fitur_akses.sql sudah dijalankan di D1!"),b}return console.log("[guard] href:",a,"| roles:",c,"| allowed:",g),g||(0,f.redirect)("/dashboard"),b}async function h(a=[]){let b=await (0,d.Ht)();return b||(0,f.redirect)("/login"),a.length>0&&((0,d.XV)(b).some(b=>a.includes(b))||(0,f.redirect)("/dashboard")),b}},49796:(a,b,c)=>{"use strict";Object.defineProperty(b,"A",{enumerable:!0,get:function(){return d.registerServerReference}});let d=c(77943)},52862:(a,b,c)=>{"use strict";c.d(b,{A:()=>i});var d=c(91986);let e=(...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim(),f=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var g={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let h=(0,d.forwardRef)(({color:a="currentColor",size:b=24,strokeWidth:c=2,absoluteStrokeWidth:f,className:h="",children:i,iconNode:j,...k},l)=>(0,d.createElement)("svg",{ref:l,...g,width:b,height:b,stroke:a,strokeWidth:f?24*Number(c)/Number(b):c,className:e("lucide",h),...!i&&!(a=>{for(let b in a)if(b.startsWith("aria-")||"role"===b||"title"===b)return!0;return!1})(k)&&{"aria-hidden":"true"},...k},[...j.map(([a,b])=>(0,d.createElement)(a,b)),...Array.isArray(i)?i:[i]])),i=(a,b)=>{let c=(0,d.forwardRef)(({className:c,...g},i)=>(0,d.createElement)(h,{ref:i,iconNode:b,className:e(`lucide-${f(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,c),...g}));return c.displayName=f(a),c}},55743:(a,b,c)=>{"use strict";c.d(b,{HA:()=>k,Yf:()=>i,ZW:()=>j,hj:()=>h});var d=c(44075),e=c(23755),f=c(65926);function g(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function h(){try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(g)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function i(a,b,c){if(!a)return!1;if((0,e.qc)(a))return!0;let g=(0,e.XV)(a);if(0===g.length)return!1;try{return(await (0,d.P)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND ${"create"===c?"can_create":"update"===c?"can_update":"can_delete"} = 1`,[b])).some(a=>(0,f.Q)([a.role],g))}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function j(a,b){return i(await (0,e.Ht)(),a,b)}async function k(a,b){let c=await (0,e.Ht)(),d=await i(c,a,b);return c?d?c:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}},63059:(a,b,c)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0});var d={default:function(){return i},useLinkStatus:function(){return h.useLinkStatus}};for(var e in d)Object.defineProperty(b,e,{enumerable:!0,get:d[e]});let f=c(7904),g=c(5735),h=f._(c(23318));function i(a){let b=a.legacyBehavior,c="string"==typeof a.children||"number"==typeof a.children||"string"==typeof a.children?.type,d=a.children?.type?.$$typeof===Symbol.for("react.client.reference");return!b||c||d||(a.children?.type?.$$typeof===Symbol.for("react.lazy")?console.error("Using a Lazy Component as a direct child of `<Link legacyBehavior>` from a Server Component is not supported. If you need legacyBehavior, wrap your Lazy Component in a Client Component that renders the Link's `<a>` tag."):console.error("Using a Server Component as a direct child of `<Link legacyBehavior>` is not supported. If you need legacyBehavior, wrap your Server Component in a Client Component that renders the Link's `<a>` tag.")),(0,g.jsx)(h.default,{...a})}("function"==typeof b.default||"object"==typeof b.default&&null!==b.default)&&void 0===b.default.__esModule&&(Object.defineProperty(b.default,"__esModule",{value:!0}),Object.assign(b.default,b),a.exports=b.default)},74812:(a,b,c)=>{"use strict";c.d(b,{Av:()=>f,FY:()=>m,GP:()=>n,Lx:()=>e,Oh:()=>j,Wd:()=>o,kM:()=>k,mp:()=>h,uq:()=>g});var d=c(44075);let e=["REGULER","SADESA"],f=["BARU",...e],g="santri_baru_mulai_berlaku",h="santri_baru_durasi_bulan",i="2026-07-01";function j(a){return"SADESA"===String(a??"").trim().toUpperCase()?"SADESA":"REGULER"}function k(a="s"){let b=`(SELECT value FROM app_settings WHERE key = '${g}')`,c=`(SELECT value FROM app_settings WHERE key = '${h}')`;return`CASE
    WHEN ${a}.status_global = 'aktif'
      AND ${a}.created_at IS NOT NULL
      AND date(${a}.created_at) >= date(COALESCE(${b}, '${i}'))
      AND datetime(${a}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${c}, '3') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${a}.kategori_santri, ''), 'REGULER')
  END`}async function l(){await (0,d.g7)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `),await (0,d.g7)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[g,i]),await (0,d.g7)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[h,String(3)])}async function m(){await l();let[a,b]=await Promise.all([(0,d.Zy)("SELECT value FROM app_settings WHERE key = ?",[g]),(0,d.Zy)("SELECT value FROM app_settings WHERE key = ?",[h])]);return{mulaiBerlaku:n(a?.value),durasiBulan:o(b?.value)}}function n(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:i}function o(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}},89991:(a,b,c)=>{"use strict";c.r(b),c.d(b,{"00412ff9fefe976069e110b5046bf517ce1f21ed43":()=>d.C});var d=c(38052)}};