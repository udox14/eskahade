module.exports=[37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value`),"__NEXT_ERROR_CODE",{value:"E352",enumerable:!1,configurable:!0})}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ensureServerEntryExports",{enumerable:!0,get:function(){return d}})},6846,a=>{"use strict";var b=a.i(5246),c=a.i(12259);let d=new Set(["password","password_hash","token","cookie","cookies","authorization","auth","secret"]),e=null,f=new Map;function g(a,b=500){return a.length<=b?a:`${a.slice(0,b)}...`}function h(a){return null==a?null:"string"==typeof a?g(a):"number"==typeof a||"boolean"==typeof a?a:Array.isArray(a)?a.slice(0,25).map(h):"object"==typeof a?Object.fromEntries(Object.entries(a).filter(([a])=>!d.has(a.toLowerCase())).slice(0,50).map(([a,b])=>[a,h(b)])):String(a)}function i(a){return a?{id:a.id,name:a.full_name,email:a.email,roles:a.roles}:null}async function j(){try{let a=await (0,b.headers)(),c=a.get("x-forwarded-for");return{ipAddress:a.get("cf-connecting-ip")??(c?c.split(",")[0]?.trim():null)??null,userAgent:a.get("user-agent")}}catch{return{ipAddress:null,userAgent:null}}}async function k(){e||(e=(async()=>{await (0,c.execute)(`
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
      `),await (0,c.execute)(`
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
      `),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON activity_log(actor_user_id)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)");try{await (0,c.execute)(`
          INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
          VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9)
        `),await (0,c.execute)(`
          INSERT OR IGNORE INTO activity_log_config (
            fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
          )
          SELECT href, group_name, title, 1, 1, 1, datetime('now')
          FROM fitur_akses
          WHERE href IS NOT NULL
            AND TRIM(href) <> ''
        `)}catch{}})().catch(a=>{throw e=null,a})),await e}async function l(a,b){if(!a||!b)return!0;let d=`${a}:${b}`,e=f.get(d);if(e&&e.expiresAt>Date.now())return e.values[b];await k();let g=await (0,c.queryOne)(`SELECT log_create, log_update, log_delete
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]),h=g?{create:1===g.log_create,update:1===g.log_update,delete:1===g.log_delete}:{create:!0,update:!0,delete:!0},i=Date.now()+6e4;return f.set(`${a}:create`,{expiresAt:i,values:h}),f.set(`${a}:update`,{expiresAt:i,values:h}),f.set(`${a}:delete`,{expiresAt:i,values:h}),h[b]}async function m(){return await k(),(0,c.query)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     ORDER BY group_name ASC, title ASC`)}async function n(a,b,d){await k();let e=await (0,c.queryOne)(`SELECT fitur_href, group_name, title, log_create, log_update, log_delete, updated_at, updated_by
     FROM activity_log_config
     WHERE fitur_href = ?`,[a]);if(!e)throw Error("Konfigurasi log fitur tidak ditemukan.");let g={create:b.create??1===e.log_create,update:b.update??1===e.log_update,delete:b.delete??1===e.log_delete};await (0,c.execute)(`UPDATE activity_log_config
     SET log_create = ?, log_update = ?, log_delete = ?, updated_at = datetime('now'), updated_by = ?
     WHERE fitur_href = ?`,[+!!g.create,+!!g.update,+!!g.delete,d,a]);let h=Date.now()+6e4,i={create:g.create,update:g.update,delete:g.delete};f.set(`${a}:create`,{expiresAt:h,values:i}),f.set(`${a}:update`,{expiresAt:h,values:i}),f.set(`${a}:delete`,{expiresAt:h,values:i})}async function o(a){try{var b,d;if(await k(),!await l(a.fiturHref,a.logKind))return;let e=a.requestInfo??await j(),f=a.actor??null;await (0,c.execute)(`INSERT INTO activity_log (
        id, created_at, actor_user_id, actor_name, actor_roles, module, action,
        entity_type, entity_id, entity_label, summary, details_json, status,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},53457,a=>{"use strict";let b=["AL-BAGHORY"];function c(a){return b.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!b.includes(a)),a.s(["isAsramaTanpaKamar",()=>c])},68476,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(53457),f=a.i(13095);let g=["ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4"];async function h(){let a=await (0,d.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null,isPutri:g.includes(a.asrama_binaan||"")}:null}async function i(a){return(0,e.isAsramaTanpaKamar)(a)?[]:(await (0,c.query)(`
    SELECT DISTINCT kamar FROM santri 
    WHERE asrama = ? AND status_global = 'aktif'
  `,[a])).map(a=>a.kamar||"Tanpa Kamar").sort((a,b)=>(parseInt(a)||999)-(parseInt(b)||999))}async function j(a,b,d){if((0,e.isAsramaTanpaKamar)(a))return{santriList:[],alfaPerSantri:{},detailPerSantri:{}};let[f,g]=b.split("-"),h=d||`${f}-${g}-01`,i=d||`${f}-${g}-31`,j=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar, a.santri_id, a.tanggal, a.status FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `,[h,i,a]),k={},l={},m={};return j.forEach(a=>{k[a.id]||(k[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar}),l[a.santri_id]||(l[a.santri_id]={}),l[a.santri_id][a.tanggal]=a.status,m[a.santri_id]=(m[a.santri_id]||0)+1}),{santriList:Object.values(k),alfaPerSantri:m,detailPerSantri:l}}async function k(a){if((0,e.isAsramaTanpaKamar)(a))return[];let b=await (0,c.query)(`
    SELECT
      s.id,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      a.tanggal,
      a.keterangan
    FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE s.asrama = ?
      AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal DESC
  `,[a]),d={};return b.forEach(a=>{d[a.id]||(d[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar,total_alfa:0,tanggal:[]}),d[a.id].total_alfa+=1,d[a.id].tanggal.push({tanggal:a.tanggal,keterangan:a.keterangan||null})}),Object.values(d)}async function l(a,b,d){if((0,e.isAsramaTanpaKamar)(a))return{santriList:[],detail:{}};let[f,g]=b.split("-"),h=`${f}-${g}-01`,i=`${f}-${g}-31`,j=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `,[a]);if(!j.length)return{santriList:[],detail:{}};let k=await (0,c.query)(`
    SELECT a.santri_id, a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ? AND s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY a.tanggal
  `,[h,i,a]),l={};return k.forEach(a=>{l[a.santri_id]||(l[a.santri_id]={}),l[a.santri_id][a.tanggal]={shubuh:d&&"H"===a.shubuh?"S":a.shubuh,dzuhur:d&&"H"===a.dzuhur?"S":a.dzuhur,ashar:d&&"H"===a.ashar?"S":a.ashar,maghrib:d&&"H"===a.maghrib?"S":a.maghrib,isya:d&&"H"===a.isya?"S":a.isya}}),{santriList:j,detail:l}}async function m(a){return(0,e.isAsramaTanpaKamar)(a)?[]:(0,c.query)(`
    SELECT id, nama_lengkap, nis, kamar FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY CAST(kamar AS INTEGER), nama_lengkap
  `,[a])}async function n(a,b,d){if((0,e.isAsramaTanpaKamar)(a))return{santriList:[],detail:{}};let f=await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya
    FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND (a.shubuh = 'A' OR a.dzuhur = 'A' OR a.ashar = 'A' OR a.maghrib = 'A' OR a.isya = 'A')
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `,[b,d,a]),g={},h={};return f.forEach(a=>{g[a.id]||(g[a.id]={id:a.id,nama_lengkap:a.nama_lengkap,nis:a.nis,kamar:a.kamar}),h[a.id]||(h[a.id]={}),h[a.id][a.tanggal]={shubuh:"A"===a.shubuh?"A":null,dzuhur:"A"===a.dzuhur?"A":null,ashar:"A"===a.ashar?"A":null,maghrib:"A"===a.maghrib?"A":null,isya:"A"===a.isya?"A":null}}),{santriList:Object.values(g),detail:h}}async function o(a){if(!a.length)return{success:!0,count:0};let b=new Set(["shubuh","dzuhur","ashar","maghrib","isya"]),d=a.filter(a=>b.has(a.waktu));if(!d.length)return{success:!0,count:0};let e={};d.forEach(a=>{let b=`${a.santriId}|${a.tanggal}`;e[b]||(e[b]=new Set),e[b].add(a.waktu)});let f=[];Object.entries(e).forEach(([a,b])=>{let[c,d]=a.split("|"),e=[];b.has("shubuh")&&e.push("shubuh = NULL"),b.has("dzuhur")&&e.push("dzuhur = NULL"),b.has("ashar")&&e.push("ashar = NULL"),b.has("maghrib")&&e.push("maghrib = NULL"),b.has("isya")&&e.push("isya = NULL"),f.push({sql:`UPDATE absen_berjamaah SET ${e.join(", ")} WHERE santri_id = ? AND tanggal = ?`,params:[c,d]}),f.push({sql:"DELETE FROM absen_berjamaah WHERE santri_id = ? AND tanggal = ? AND shubuh IS NULL AND dzuhur IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL",params:[c,d]})});for(let a=0;a<f.length;a+=50)await (0,c.batch)(f.slice(a,a+50));return{success:!0,count:d.length}}async function p(a){if(!a||!a.length)return{success:!0,count:0};let b=await (0,d.getSession)(),e=b?.id||null,f=a.map(a=>({sql:`
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, ashar, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = COALESCE(absen_berjamaah.shubuh, excluded.shubuh),
        ashar  = COALESCE(absen_berjamaah.ashar, excluded.ashar)
    `,params:[a.santri_id,a.tanggal,a.shubuh||null,a.ashar||null,e]}));try{for(let a=0;a<f.length;a+=50){let b=f.slice(a,a+50);await (0,c.batch)(b)}return{success:!0,count:a.length}}catch(a){return{error:a.message}}}(0,f.ensureServerEntryExports)([h,i,j,k,l,m,n,o,p]),(0,b.registerServerReference)(h,"00e0c20cf1cdc8c78f096cafd3aafe533d5394153d",null),(0,b.registerServerReference)(i,"40a1f7a6475d74689812868fa0c83852b51b556f62",null),(0,b.registerServerReference)(j,"70dfc33348cab30d41b3b3f2b8cf073cad04fc6a14",null),(0,b.registerServerReference)(k,"40cbbf32ba25ce00cc0fd11e09071c9bf75da1bbc5",null),(0,b.registerServerReference)(l,"70158e3c3461906a7efd12556e301f704639b899aa",null),(0,b.registerServerReference)(m,"40aac1ebfd63334623c060d25c1e3798fdaec73a8b",null),(0,b.registerServerReference)(n,"704d6137b8db14185dfefc39f27e7b7b23e81da0c3",null),(0,b.registerServerReference)(o,"401b0cdca67d3105586f69f1d3a97a0b4571a9494f",null),(0,b.registerServerReference)(p,"4008193333f0ced547d21d5d93c80228a345ef3138",null),a.s(["deleteAbsenBerjamaahRecords",()=>o,"getKamarList",()=>i,"getRekapAbsenBerjamaah",()=>l,"getRekapAbsenMalam",()=>j,"getRekapBerjamaahAlfaRange",()=>n,"getRiwayatAlfaAbsenMalam",()=>k,"getSantriByAsrama",()=>m,"getSessionRekap",()=>h,"importAbsenBerjamaahFingerprint",()=>p])},89074,a=>{"use strict";var b=a.i(24895),c=a.i(68476);a.s([],13517),a.i(13517),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00e0c20cf1cdc8c78f096cafd3aafe533d5394153d",()=>c.getSessionRekap,"4008193333f0ced547d21d5d93c80228a345ef3138",()=>c.importAbsenBerjamaahFingerprint,"40a1f7a6475d74689812868fa0c83852b51b556f62",()=>c.getKamarList,"70158e3c3461906a7efd12556e301f704639b899aa",()=>c.getRekapAbsenBerjamaah,"70dfc33348cab30d41b3b3f2b8cf073cad04fc6a14",()=>c.getRekapAbsenMalam],89074)}];

//# sourceMappingURL=_3e6adf5b._.js.map