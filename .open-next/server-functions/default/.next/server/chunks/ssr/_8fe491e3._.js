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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},83908,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(13095);let f=["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4"],g="AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'",h=a=>7===a||8===a||9===a,i=a=>10===a||11===a||12===a;async function j(a,b){let c=new Date(b,a-1,1).toISOString(),e=new Date(b,a,0,23,59,59).toISOString(),j=await (0,d.query)(`SELECT id, nama_lengkap, asrama, kamar, kategori_santri, sekolah, kelas_sekolah, alamat, created_at
     FROM santri s
     WHERE s.status_global = 'aktif'
       ${g}`,[]),[k,l,m]=await Promise.all([(0,d.query)(`
      SELECT s.id,
             s.tanggal_keluar   AS created_at,
             s.alasan_keluar    AS detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.kategori_santri, s.sekolah, s.kelas_sekolah, s.alamat
      FROM santri s
      WHERE s.status_global = 'keluar'
        AND s.tanggal_keluar >= ? AND s.tanggal_keluar <= ?
        ${g}
    `,[c.slice(0,10),e.slice(0,10)]),(0,d.query)(`
      SELECT s.id, rs.id AS riwayat_id, rs.created_at, rs.detail_info,
             s.nama_lengkap, s.asrama, s.kamar, s.kategori_santri, s.sekolah, s.kelas_sekolah, s.alamat
      FROM riwayat_surat rs
      JOIN santri s ON s.id = rs.santri_id
      WHERE rs.jenis_surat = 'BERHENTI'
        AND rs.created_at >= ? AND rs.created_at <= ?
        AND s.status_global != 'keluar'
        ${g}
    `,[c,e]),(0,d.query)(`SELECT id, nama_lengkap, asrama, kamar, kategori_santri, sekolah, kelas_sekolah, alamat, created_at
       FROM santri
       WHERE status_global = 'aktif' AND created_at >= ? AND created_at <= ?
         AND UPPER(TRIM(COALESCE(asrama, ''))) <> 'AL-BAGHORY'`,[c,e])]),n=[...k,...l],o={};f.forEach(a=>{o[a]={total:0,keluar:0,masuk:0,kamar:{}}}),j.forEach(a=>{let b=a.asrama||"LAINNYA",c=a.kamar||"?";o[b]||(o[b]={total:0,keluar:0,masuk:0,kamar:{}}),o[b].total++,o[b].kamar[c]=(o[b].kamar[c]||0)+1}),n.forEach(a=>{let b=a.asrama||"LAINNYA";o[b]&&o[b].keluar++}),m.forEach(a=>{let b=a.asrama||"LAINNYA";o[b]&&o[b].masuk++});let p={};return f.forEach(a=>{p[a]={MI:0,MTS:{7:0,8:0,9:0,tot:0},MTSN:{7:0,8:0,9:0,tot:0},SMP:{7:0,8:0,9:0,tot:0},MA:{10:0,11:0,12:0,tot:0},SMA:{10:0,11:0,12:0,tot:0},SMK:{10:0,11:0,12:0,tot:0},SADESA:0,TOTAL:0}}),j.forEach(a=>{let b=a.asrama||"LAINNYA";if(!p[b])return;let c=function(a,b){if("SADESA"===b)return"SADESA";if(!a)return"LAINNYA";let c=a.toUpperCase();return c.includes("MTSN")?"MTsN 1 Tasikmalaya":c.includes("MTS")?"MTs. KH. A. WAHAB MUHSIN":c.includes("SMP")?"SMP. KHZ. Mushthafa":c.includes("MAN")?"MAN 1 Tasikmalaya":c.includes("SMA")?"SMA KHZ. Mushthafa":c.includes("SMK")?"SMK KH. A. Wahab Muhsin":c.includes("MI")?"MI":c.includes("KULIAH")?"SADESA":"LAINNYA"}(a.sekolah,a.kategori_santri),d=parseInt(a.kelas_sekolah?a.kelas_sekolah.replace(/\D/g,""):"0");p[b].TOTAL++,c.includes("MI")?p[b].MI++:c.includes("SADESA")?p[b].SADESA++:c.includes("MTsN")?(h(d)&&(p[b].MTSN[d]=(p[b].MTSN[d]||0)+1),p[b].MTSN.tot++):c.includes("MTs.")?(h(d)&&(p[b].MTS[d]=(p[b].MTS[d]||0)+1),p[b].MTS.tot++):c.includes("SMP")?(h(d)&&(p[b].SMP[d]=(p[b].SMP[d]||0)+1),p[b].SMP.tot++):c.includes("MAN")?(1===d&&(d=10),2===d&&(d=11),3===d&&(d=12),i(d)&&(p[b].MA[d]=(p[b].MA[d]||0)+1),p[b].MA.tot++):c.includes("SMA")?(1===d&&(d=10),2===d&&(d=11),3===d&&(d=12),i(d)&&(p[b].SMA[d]=(p[b].SMA[d]||0)+1),p[b].SMA.tot++):c.includes("SMK")&&(1===d&&(d=10),2===d&&(d=11),3===d&&(d=12),i(d)&&(p[b].SMK[d]=(p[b].SMK[d]||0)+1),p[b].SMK.tot++)}),{asrama:o,sekolah:p,mutasi:[...m.map(a=>({...a,mutasi_key:`MASUK:${a.id}:${a.created_at}`,tipe:"MASUK",tgl:a.created_at,ket:"Santri Baru"})),...n.map(a=>({...a,mutasi_key:`KELUAR:${a.riwayat_id||a.id}:${a.created_at}`,tipe:"KELUAR",tgl:a.created_at,ket:a.detail_info||"Berhenti"}))].sort((a,b)=>new Date(a.tgl).getTime()-new Date(b.tgl).getTime()),total_santri:j.length}}(0,e.ensureServerEntryExports)([j]),(0,c.registerServerReference)(j,"60ebc694ca7693fa9e48d3150397da51477ae2258d",null),a.s([],85402),a.i(85402),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"60ebc694ca7693fa9e48d3150397da51477ae2258d",()=>j],83908)}];

//# sourceMappingURL=_8fe491e3._.js.map