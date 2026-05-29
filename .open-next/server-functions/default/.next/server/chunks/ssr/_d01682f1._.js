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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},53457,a=>{"use strict";let b=["AL-BAGHORY"];function c(a){return b.includes((a||"").trim().toUpperCase())}["AL-FALAH","AS-SALAM","BAHAGIA","ASY-SYIFA 1","ASY-SYIFA 2","ASY-SYIFA 3","ASY-SYIFA 4","AL-BAGHORY"].filter(a=>!b.includes(a)),a.s(["isAsramaTanpaKamar",()=>c])},87994,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(53457),f=a.i(6846),g=a.i(18558);async function h(a,b){let f=await (0,d.getSession)(),g=[a],h="";b&&!(0,e.isAsramaTanpaKamar)(b)&&(h="AND s.asrama = ?",g.push(b));let i=await (0,c.query)(`
    SELECT s.id, s.kab_kota, s.alamat
    FROM santri s
    LEFT JOIN perpulangan_log pl
      ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
      ${h}
      AND pl.id IS NULL
  `,g);return i.length?(await (0,c.batch)(i.map(b=>{var d,e;let g;return{sql:`INSERT OR IGNORE INTO perpulangan_log
            (id, santri_id, periode_id, jenis_pulang, status_pulang, status_datang, created_by)
          VALUES (?, ?, ?, ?, 'BELUM', 'BELUM', ?)`,params:[(0,c.generateId)(),b.id,a,(d=b.kab_kota,e=b.alamat,(g=(d||e||"").toLowerCase().trim())?g.includes("tasikmalaya")?"DIJEMPUT":"ROMBONGAN":"DIJEMPUT"),f?.id??null]}})),i.length):0}async function i(){let a=await (0,d.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null}:null}async function j(){return(0,c.queryOne)(`
    SELECT id, nama_periode,
           tgl_mulai_pulang, tgl_selesai_pulang,
           tgl_mulai_datang, tgl_selesai_datang
    FROM perpulangan_periode
    WHERE is_active = 1
    LIMIT 1
  `)}async function k(a){return(0,e.isAsramaTanpaKamar)(a)?[]:(await (0,c.query)(`SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.kamar)}async function l(a,b,f){return!await (0,d.getSession)()||(0,e.isAsramaTanpaKamar)(a)?[]:(await h(f,a),await (0,c.query)(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           s.kab_kota, s.alamat,
           pl.id         AS log_id,
           pl.jenis_pulang,
           pl.status_pulang,
           pl.keterangan,
           pl.tgl_pulang,
           pl.status_datang,
           pl.tgl_datang
    FROM santri s
    LEFT JOIN perpulangan_log pl
      ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `,[f,a,b]))}async function m(a){let b=new Date().toISOString().slice(0,10),d=await (0,c.queryOne)("SELECT tgl_mulai_pulang, tgl_selesai_pulang FROM perpulangan_periode WHERE id = ? AND is_active = 1",[a]);return d?b<d.tgl_mulai_pulang||b>d.tgl_selesai_pulang?`Di luar periode perpulangan (${d.tgl_mulai_pulang} s/d ${d.tgl_selesai_pulang}).`:null:"Tidak ada periode aktif."}async function n(a){let b=new Date().toISOString().slice(0,10),d=await (0,c.queryOne)("SELECT tgl_mulai_datang, tgl_selesai_datang FROM perpulangan_periode WHERE id = ? AND is_active = 1",[a]);return d?b<d.tgl_mulai_datang||b>d.tgl_selesai_datang?`Di luar periode kedatangan (${d.tgl_mulai_datang} s/d ${d.tgl_selesai_datang}).`:null:"Tidak ada periode aktif."}async function o(a,b,e){let h=await (0,d.getSession)();if(!h)return{error:"Unauthorized"};let i=await m(b);return i?{error:i}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'BELUM'`,[e||null,(0,c.now)(),h.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(h),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:"Mengonfirmasi kepulangan santri",details:{periode_id:b,keterangan:e||null}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function p(a,b){let e=await (0,d.getSession)();if(!e)return{error:"Unauthorized"};let h=await m(b);return h?{error:h}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_pulang = 'BELUM', keterangan = NULL, tgl_pulang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'BELUM'`,[e.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(e),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:"Membatalkan status pulang santri",details:{periode_id:b}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function q(a,b,e,h){let i=await (0,d.getSession)();if(!i)return{error:"Unauthorized"};let j=await m(a);if(j)return{error:j};let k=await (0,c.query)(`SELECT pl.id
     FROM perpulangan_log pl
     JOIN santri s ON s.id = pl.santri_id
     WHERE pl.periode_id = ?
       AND pl.jenis_pulang = 'ROMBONGAN'
       AND pl.status_pulang = 'BELUM'
       AND s.asrama = ? AND s.kamar = ?`,[a,b,e]);if(!k.length)return{success:!0,count:0};let l=(0,c.now)();return await (0,c.batch)(k.map(a=>({sql:`UPDATE perpulangan_log
          SET status_pulang = 'PULANG', keterangan = ?, tgl_pulang = ?, updated_by = ?
          WHERE id = ?`,params:[h||"Rombongan",l,i.id,a.id]}))),await (0,f.logActivity)({actor:(0,f.actorFromSession)(i),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log_batch",entityId:`${b}:${e}`,entityLabel:`${b} kamar ${e}`,summary:`Mengonfirmasi pulang rombongan kamar ${e}`,details:{periode_id:a,asrama:b,kamar:e,count:k.length,keterangan:h||"Rombongan"}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0,count:k.length}}async function r(a,b){let e=await (0,d.getSession)();return e?(await (0,c.execute)("UPDATE perpulangan_log SET jenis_pulang = ?, updated_by = ? WHERE id = ?",[b,e.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(e),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:`Mengubah jenis pulang menjadi ${b}`,details:{jenis_pulang:b}}),{success:!0}):{error:"Unauthorized"}}async function s(a,b){let e=await (0,d.getSession)();return e?(await (0,c.execute)("UPDATE perpulangan_log SET keterangan = ?, updated_by = ? WHERE id = ?",[b||null,e.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(e),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:"Memperbarui keterangan perpulangan",details:{keterangan:b||null}}),{success:!0}):{error:"Unauthorized"}}async function t(a,b){let e=await (0,d.getSession)();if(!e)return{error:"Unauthorized"};let h=await n(b);return h?{error:h}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_datang = 'SUDAH', tgl_datang = ?, updated_by = ?
     WHERE id = ? AND status_pulang = 'PULANG' AND status_datang = 'BELUM'`,[(0,c.now)(),e.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(e),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:"Mengonfirmasi kedatangan santri",details:{periode_id:b}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function u(a,b){let e=await (0,d.getSession)();if(!e)return{error:"Unauthorized"};let h=await n(b);return h?{error:h}:(await (0,c.execute)(`UPDATE perpulangan_log
     SET status_datang = 'BELUM', tgl_datang = NULL, updated_by = ?
     WHERE id = ? AND status_datang = 'SUDAH'`,[e.id,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(e),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log",entityId:a,entityLabel:a,summary:"Membatalkan status datang santri",details:{periode_id:b}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan"),{success:!0})}async function v(a){let b=await (0,d.getSession)();if(!b||!(0,d.hasAnyRole)(b,["admin","keamanan","dewan_santri"]))return{error:"Akses ditolak"};let e=await (0,c.queryOne)("SELECT tgl_selesai_datang FROM perpulangan_periode WHERE id = ?",[a]);if(!e)return{error:"Periode tidak ditemukan."};if(new Date().toISOString().slice(0,10)<=e.tgl_selesai_datang)return{error:"Periode kedatangan belum selesai."};let h=await (0,c.query)(`SELECT pl.id
     FROM perpulangan_log pl
     JOIN santri s ON s.id = pl.santri_id
     WHERE pl.periode_id = ?
       AND pl.status_pulang = 'PULANG'
       AND pl.status_datang = 'BELUM'
       AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'`,[a]);return h.length?(await (0,c.batch)(h.map(a=>({sql:"UPDATE perpulangan_log SET status_datang = 'TELAT', updated_by = ? WHERE id = ?",params:[b.id,a.id]}))),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_perpulangan",action:"update",fiturHref:"/dashboard/asrama/perpulangan",logKind:"update",entityType:"perpulangan_log_batch",entityId:`telat:${a}`,entityLabel:`Periode ${a}`,summary:`Menandai ${h.length} santri telat datang`,details:{periode_id:a,count:h.length}}),(0,g.revalidatePath)("/dashboard/asrama/perpulangan/monitoring"),{success:!0,count:h.length}):{success:!0,count:0}}(0,a.i(13095).ensureServerEntryExports)([h,i,j,k,l,o,p,q,r,s,t,u,v]),(0,b.registerServerReference)(h,"60d5791e3302a86d7052be572df46816a46f7b8d0b",null),(0,b.registerServerReference)(i,"0036982f85ea4fc01dde2e791aff1ce0ff8809f303",null),(0,b.registerServerReference)(j,"0078e9f4b9a1f0d96532d56dfb4e9fce3f1d3943f6",null),(0,b.registerServerReference)(k,"40f0eae60f5a34bd7ff0a3c94be5198f13a62ca55f",null),(0,b.registerServerReference)(l,"70981e2ab15ce56dc363dfae038ed9ca377dc51957",null),(0,b.registerServerReference)(o,"70eeab1b89801f0594f80b52c52aa13de790e984f3",null),(0,b.registerServerReference)(p,"60d8f3ba11d2af49b1b120900d7423046a0df0376c",null),(0,b.registerServerReference)(q,"78ca42381403b050a11d9e28e350b218cb735185af",null),(0,b.registerServerReference)(r,"60535ae86d4bacc32ff1833124c8d6dfd254a048c1",null),(0,b.registerServerReference)(s,"60a2e14adb5be10ca617e3cf43ef63b299408ae84e",null),(0,b.registerServerReference)(t,"607cdd57bc58cb51becbe40fac8dce783ca11b0a13",null),(0,b.registerServerReference)(u,"608f6b6bae644280f8d16fedc250028768d8a823b6",null),(0,b.registerServerReference)(v,"4078da1408446a6f1b1a0d268bb26ca73708b2e502",null),a.s(["batalDatang",()=>u,"batalPulang",()=>p,"ensurePeriodeLogs",()=>h,"getDataKamarPerpulangan",()=>l,"getKamarsPerpulangan",()=>k,"getPeriodeAktif",()=>j,"getSessionInfo",()=>i,"konfirmasiDatang",()=>t,"konfirmasiPulang",()=>o,"konfirmasiRombonganKamar",()=>q,"tandaiTelatMassal",()=>v,"updateJenisPulang",()=>r,"updateKeterangan",()=>s])},52504,a=>{"use strict";var b=a.i(24895),c=a.i(87994),d=a.i(37936),e=a.i(12259),f=a.i(53058);async function g(){let a=await (0,f.getSession)();return a?{role:a.role,asrama_binaan:a.asrama_binaan??null}:null}async function h(a,b){if(!await (0,f.getSession)())return[];await (0,c.ensurePeriodeLogs)(a,b);let d=b?"AND s.asrama = ?":"",g=[a];return b&&g.push(b),await (0,e.query)(`
    SELECT
      s.asrama,
      COUNT(*)                                                                AS total,
      SUM(CASE WHEN pl.status_pulang = 'PULANG' THEN 1 ELSE 0 END)          AS sudah_pulang,
      SUM(CASE WHEN pl.status_pulang = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_pulang,
      SUM(CASE WHEN pl.status_datang = 'SUDAH'  THEN 1 ELSE 0 END)          AS sudah_datang,
      SUM(CASE WHEN pl.status_pulang = 'PULANG'
               AND pl.status_datang  = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_datang,
      SUM(CASE WHEN pl.status_datang IN ('TELAT','VONIS') THEN 1 ELSE 0 END) AS telat
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
      ${d}
    GROUP BY s.asrama
    ORDER BY s.asrama
  `,g)}async function i(a,b){return await (0,c.ensurePeriodeLogs)(a,b),await (0,e.query)(`
    SELECT
      s.kamar,
      COUNT(*)                                                                AS total,
      SUM(CASE WHEN pl.status_pulang = 'PULANG' THEN 1 ELSE 0 END)          AS sudah_pulang,
      SUM(CASE WHEN pl.status_pulang = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_pulang,
      SUM(CASE WHEN pl.status_datang = 'SUDAH'  THEN 1 ELSE 0 END)          AS sudah_datang,
      SUM(CASE WHEN pl.status_pulang = 'PULANG'
               AND pl.status_datang  = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_datang,
      SUM(CASE WHEN pl.status_datang IN ('TELAT','VONIS') THEN 1 ELSE 0 END) AS telat
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
      AND s.asrama = ?
    GROUP BY s.kamar
    ORDER BY CAST(s.kamar AS INTEGER), s.kamar
  `,[a,b])}async function j(a,b,d){return await (0,c.ensurePeriodeLogs)(a,b),(0,e.query)(`
    SELECT s.id, s.nama_lengkap, s.nis,
           pl.jenis_pulang, pl.status_pulang, pl.status_datang,
           pl.keterangan, pl.tgl_pulang, pl.tgl_datang
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
      AND s.asrama = ? AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `,[a,b,d])}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j]),(0,d.registerServerReference)(g,"00ebbe4bcab3916d9ab11f976412a2da506b70c61c",null),(0,d.registerServerReference)(h,"60fbe5b6c6a78e4a73ed5383cde20486932122cefd",null),(0,d.registerServerReference)(i,"60d28cab7a38105f5657f6425eeefdafcba8cba5fd",null),(0,d.registerServerReference)(j,"70c892caa67948e1e94ab41a258c4af61077a11cd8",null),a.s([],95291),a.i(95291),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"0078e9f4b9a1f0d96532d56dfb4e9fce3f1d3943f6",()=>c.getPeriodeAktif,"00ebbe4bcab3916d9ab11f976412a2da506b70c61c",()=>g,"4078da1408446a6f1b1a0d268bb26ca73708b2e502",()=>c.tandaiTelatMassal,"60d28cab7a38105f5657f6425eeefdafcba8cba5fd",()=>i,"60fbe5b6c6a78e4a73ed5383cde20486932122cefd",()=>h,"70c892caa67948e1e94ab41a258c4af61077a11cd8",()=>j],52504)}];

//# sourceMappingURL=_d01682f1._.js.map