module.exports=[59398,a=>{"use strict";var b=a.i(12259),c=a.i(53058);function d(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function e(){try{return(await (0,b.query)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(d)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function f(a,d,e){if(!a)return!1;if((0,c.isAdmin)(a))return!0;let f=(0,c.getEffectiveRoles)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,b.queryOne)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===e?"can_create":"update"===e?"can_update":"can_delete"} = 1
       LIMIT 1`,[d,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function g(a,b){return f(await (0,c.getSession)(),a,b)}async function h(a,b){let d=await (0,c.getSession)(),e=await f(d,a,b);return d?e?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertCrud",()=>h,"canCrud",()=>g,"canCrudForSession",()=>f,"getCrudPermissionsForAdmin",()=>e])},4552,a=>{"use strict";var b=a.i(53058),c=a.i(54645),d=a.i(59398);async function e(a,d){if(!a)return!1;if((0,b.isAdmin)(a))return!0;let e=(0,b.getEffectiveRoles)(a);if(0===e.length)return!1;try{return await (0,c.canAccessHref)(d,e,a.id)}catch(a){return console.error("[feature] canAccessFeatureForSession ERROR untuk",d,"-",a?.message),!1}}async function f(a,b,c="read"){return"read"===c?e(a,b):(0,d.canCrudForSession)(a,b,c)}async function g(a,c="read"){let d=await (0,b.getSession)();return d?await f(d,a,c)?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertFeature",()=>g,"canAccessFeatureForSession",()=>e])},37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},3208,a=>{"use strict";function b(a,c="start"){let d=a.trim();return new Date(d?`${d}${"end"===c?"T23:59:59.999+07:00":"T00:00:00+07:00"}`:"")}function c(a){let b=a.trim();if(!b)return new Date("");if(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(b))return new Date(b);let c=16===b.length?`${b}:00`:b;return new Date(`${c}+07:00`)}a.s(["parseWibDate",()=>b,"parseWibDateTime",()=>c])},2856,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(4552),f=a.i(53058),g=a.i(6846),h=a.i(3208),i=a.i(18558),j=a.i(13095);let k="keamanan_perizinan_alasan",l=["SAKIT","BEROBAT","KONTROL","ACARA KELUARGA","ACARA","SURVEI SEKOLAH / KULIAH","TEST SEKOLAH / KULIAH","MEMBUAT PERSYARATAN","ORANGTUA MENINGGAL","KELUARGA MENINGGAL"];function m(a){return!Number.isNaN(a.getTime())}function n(a){let b,c,d=String(a.get("jenis")??"").trim(),e=String(a.get("alasan_dropdown")??"").trim(),f=String(a.get("deskripsi")??"").trim(),g=String(a.get("pemberi_izin")??"").trim();if(!d)return{error:"Jenis izin wajib dipilih."};if(!e)return{error:"Keperluan dasar wajib dipilih."};if(!g)return{error:"Pemberi izin wajib dipilih."};let i=f?`${e} - ${f}`:e;if("PULANG"===d){let d=String(a.get("date_start")??"").trim(),e=String(a.get("date_end")??"").trim();if(!d||!e)return{error:"Tanggal pulang dan batas kembali wajib diisi."};b=(0,h.parseWibDate)(d,"start"),c=(0,h.parseWibDate)(e,"end")}else{if("KELUAR_KOMPLEK"!==d)return{error:"Jenis izin tidak dikenali."};let e=String(a.get("date_single")??"").trim(),f=String(a.get("time_start")??"").trim(),g=String(a.get("time_end")??"").trim();if(!e||!f||!g)return{error:"Tanggal dan jam izin wajib diisi lengkap."};b=new Date(`${e}T${f}:00+07:00`),c=new Date(`${e}T${g}:00+07:00`)}return m(b)&&m(c)?c<b?{error:"Batas kembali tidak boleh lebih awal dari waktu mulai izin."}:{jenis:d,alasan_final:i,pemberi_izin:g,tgl_mulai:b.toISOString(),tgl_selesai_rencana:c.toISOString()}:{error:"Format tanggal atau jam izin tidak valid."}}async function o(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)}function p(a){return[...new Set(a.map(a=>String(a??"").trim().toUpperCase()).filter(Boolean))]}async function q(){await o();let a=await (0,d.queryOne)("SELECT value FROM app_settings WHERE key = ?",[k]);if(!a?.value)return l;try{let b=JSON.parse(a.value);if(!Array.isArray(b))return l;let c=p(b);return c.length?c:l}catch{return l}}async function r(a){let b=await (0,e.assertFeature)("/dashboard/keamanan/perizinan");if("error"in b)return b;let c=await (0,f.getSession)(),h=p(a);return 0===h.length?{error:"Minimal harus ada 1 alasan izin."}:(await o(),await (0,d.execute)(`INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,[k,JSON.stringify(h)]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan_perizinan",action:"update",fiturHref:"/dashboard/keamanan/perizinan",logKind:"update",entityType:"app_setting",entityId:k,entityLabel:"Alasan izin",summary:"Memperbarui daftar alasan izin",details:{total_alasan:h.length}}),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0,rows:h})}async function s(){return(await (0,d.query)(`SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`)).map(a=>a.asrama)}function t(a){let b=[],c=[];if(a.asrama&&"SEMUA"!==a.asrama&&(b.push("s.asrama = ?"),c.push(a.asrama)),a.search&&(b.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),c.push(`%${a.search}%`,`%${a.search}%`)),a.tglAwal&&a.tglAkhir){let d=new Date(`${a.tglAwal}T00:00:00+07:00`).toISOString(),e=new Date(`${a.tglAkhir}T23:59:59+07:00`).toISOString();b.push("p.tgl_mulai <= ? AND (p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)"),c.push(e,d)}else if(a.tglAwal){let d=new Date(`${a.tglAwal}T00:00:00+07:00`).toISOString();b.push("(p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)"),c.push(d)}else if(a.tglAkhir){let d=new Date(`${a.tglAkhir}T23:59:59+07:00`).toISOString();b.push("p.tgl_mulai <= ?"),c.push(d)}return"BELUM_KEMBALI"===a.statusFilter?b.push("p.status = 'AKTIF'"):"SUDAH_KEMBALI"===a.statusFilter?b.push("p.status = 'KEMBALI'"):"TERLAMBAT"===a.statusFilter?(b.push("((p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana) OR (p.status = 'AKTIF' AND p.tgl_selesai_rencana < ?))"),c.push(new Date().toISOString())):"TEPAT_WAKTU"===a.statusFilter&&b.push("p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana"),{clauses:b,baseParams:c}}async function u(a){let{page:b=1,pageSize:c=10,...e}=a,{clauses:f,baseParams:g}=t(e),h=f.length>0?f.join(" AND "):"1=1",i=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM perizinan p JOIN santri s ON s.id = p.santri_id WHERE ${h}`,g),j=i?.total??0;return{rows:await (0,d.query)(`SELECT p.id, p.created_at, p.status, p.jenis, p.alasan, p.pemberi_izin,
            p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
            s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar
     FROM perizinan p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${h}
     ORDER BY p.status ASC, p.created_at DESC
     LIMIT ? OFFSET ?`,[...g,c,(b-1)*c]),total:j,page:b,totalPages:Math.ceil(j/c)}}async function v(a){let{clauses:b,baseParams:c}=t(a),e=b.length>0?b.join(" AND "):"1=1";return(0,d.query)(`
    SELECT s.nama_lengkap, s.nis, s.asrama, s.kamar,
           p.jenis, p.alasan, p.pemberi_izin, p.status,
           p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
    ORDER BY p.status ASC, p.tgl_mulai DESC
  `,c)}async function w(a){let{clauses:b,baseParams:c}=t({...a}),e=b.length>0?b.join(" AND "):"1=1",f=await (0,d.queryOne)(`
    SELECT 
      COUNT(p.id) as total_izin,
      SUM(CASE WHEN p.jenis = 'PULANG' THEN 1 ELSE 0 END) as izin_pulang,
      SUM(CASE WHEN p.jenis = 'KELUAR_KOMPLEK' THEN 1 ELSE 0 END) as izin_keluar,
      SUM(CASE WHEN p.status = 'AKTIF' THEN 1 ELSE 0 END) as belum_kembali,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana THEN 1 ELSE 0 END) as tepat_waktu,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as terlambat_kembali
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
  `,c);return{total:f?.total_izin||0,pulang:f?.izin_pulang||0,keluar:f?.izin_keluar||0,aktif:f?.belum_kembali||0,tepat:f?.tepat_waktu||0,telat:f?.terlambat_kembali||0}}async function x(a){let{clauses:b,baseParams:c}=t({...a}),e=b.length>0?b.join(" AND "):"1=1";return(0,d.query)(`
    SELECT s.id, s.nama_lengkap, s.asrama, s.kamar, COUNT(p.id) as total_izin,
           SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as total_telat
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${e}
    GROUP BY s.id, s.nama_lengkap, s.asrama, s.kamar
    HAVING total_izin > 0
    ORDER BY total_izin DESC, total_telat DESC
    LIMIT 5
  `,c)}async function y(a,b){let c=await (0,e.assertFeature)("/dashboard/keamanan/perizinan");if("error"in c)return c;let h=await (0,f.getSession)(),j=await (0,d.queryOne)(`SELECT p.id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.alasan, p.pemberi_izin, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,[a]);if(!j)return{error:"Data izin tidak ditemukan."};let k=n(b);if("error"in k)return k;let{jenis:l,tgl_mulai:m,tgl_selesai_rencana:o,alasan_final:p,pemberi_izin:q}=k;return await (0,d.execute)(`
    UPDATE perizinan 
    SET jenis = ?, tgl_mulai = ?, tgl_selesai_rencana = ?, alasan = ?, pemberi_izin = ?
    WHERE id = ? AND status = 'AKTIF'
  `,[l,m,o,p,q,a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(h),module:"keamanan_perizinan",action:"update",fiturHref:"/dashboard/keamanan/perizinan",logKind:"update",entityType:"perizinan",entityId:a,entityLabel:String(j.nama_lengkap||a),summary:`Memperbarui izin untuk ${String(j.nama_lengkap||a)}`,details:{changed_fields:(0,g.diffWhitelistedFields)(j,{jenis:l,tgl_mulai:m,tgl_selesai_rencana:o,alasan:p,pemberi_izin:q},["jenis","tgl_mulai","tgl_selesai_rencana","alasan","pemberi_izin"])}}),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}}async function z(a){let b=await (0,e.assertFeature)("/dashboard/keamanan/perizinan");if("error"in b)return b;let c=String(a.get("santri_id")??"").trim();if(!c)return{error:"Santri wajib dipilih terlebih dahulu."};let h=n(a);if("error"in h)return h;let{jenis:j,tgl_mulai:k,tgl_selesai_rencana:l,alasan_final:m,pemberi_izin:o}=h,p=(0,d.generateId)(),q=await (0,f.getSession)(),r=await (0,d.queryOne)("SELECT nama_lengkap, nis FROM santri WHERE id = ?",[c]);return await (0,d.execute)(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `,[p,c,j,k,l,m,o,b?.id??null]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(q),module:"keamanan_perizinan",action:"create",fiturHref:"/dashboard/keamanan/perizinan",logKind:"create",entityType:"perizinan",entityId:p,entityLabel:r?.nama_lengkap||r?.nis||c,summary:`Mencatat izin untuk ${r?.nama_lengkap||r?.nis||c}`,details:{jenis:j,alasan:m,pemberi_izin:o,tgl_mulai:k,tgl_selesai_rencana:l}}),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}}async function A(a,b){let c=await (0,e.assertFeature)("/dashboard/keamanan/perizinan");if("error"in c)return c;let j=await (0,f.getSession)(),k=await (0,d.queryOne)(`SELECT p.jenis, p.tgl_selesai_rencana, s.nama_lengkap AS santri_nama
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,[a]);if(!k)return{error:"Data izin tidak ditemukan."};let l="PULANG"===k.jenis?(0,h.parseWibDate)(b,"start"):(0,h.parseWibDateTime)(b);if(!m(l))return{error:"Waktu datang tidak valid."};let n=l>new Date(k.tgl_selesai_rencana),o=n?"AKTIF":"KEMBALI";return(await (0,d.execute)("UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ?",[o,l.toISOString(),a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(j),module:"keamanan_perizinan",action:"update",fiturHref:"/dashboard/keamanan/perizinan",logKind:"update",entityType:"perizinan",entityId:a,entityLabel:k.santri_nama||a,summary:`Mencatat kedatangan santri izin ${k.santri_nama||a}`,details:{waktu_datang:l.toISOString(),status_final:o,telat:n}}),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),n)?{success:!0,message:"Terlambat! Masuk antrian verifikasi."}:{success:!0,message:"Tepat waktu. Izin selesai."}}async function B(a){return(0,d.query)(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE nama_lengkap LIKE ?
    LIMIT 5
  `,[`%${a}%`])}async function C(a){let b=await (0,e.assertFeature)("/dashboard/keamanan/perizinan");if("error"in b)return b;let c=await (0,f.getSession)(),h=await (0,d.queryOne)(`SELECT p.id, p.jenis, p.alasan, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,[a]);return h?(await (0,d.execute)("DELETE FROM perizinan WHERE id = ?",[a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan_perizinan",action:"delete",fiturHref:"/dashboard/keamanan/perizinan",logKind:"delete",entityType:"perizinan",entityId:a,entityLabel:h.nama_lengkap||a,summary:`Menghapus data izin ${h.nama_lengkap||a}`,details:{jenis:h.jenis,alasan:h.alasan}}),(0,i.revalidatePath)("/dashboard/keamanan/perizinan"),{success:!0}):{error:"Data izin tidak ditemukan."}}(0,j.ensureServerEntryExports)([q,r,s,u,v,w,x,y,z,A,B,C]),(0,c.registerServerReference)(q,"00e2f9ca752b1c30013dab093af07d0f14174aa264",null),(0,c.registerServerReference)(r,"406a68d661855fda3bdabf4cbe336afdaf2a3ca3ea",null),(0,c.registerServerReference)(s,"00c868ee13674a1a9cfad57bee099d7292f9e67eb4",null),(0,c.registerServerReference)(u,"403b0268c01a8d016ea3b0bd426a34770bc44f1125",null),(0,c.registerServerReference)(v,"4037342f17aaec0e31252dafd2a1e4260adf198bf6",null),(0,c.registerServerReference)(w,"408ea785691725ca5c01424ed3e0bcf97036136166",null),(0,c.registerServerReference)(x,"4081dddf8d01a0fc8e3c2f11ef34dd1744b9d043b4",null),(0,c.registerServerReference)(y,"6073314c494bb655a32b43b95cff425ad406173b3c",null),(0,c.registerServerReference)(z,"40bdb2869cbcb1084820438f29f810270689b32b93",null),(0,c.registerServerReference)(A,"60f3ffb9732ccbf8aa15d6f1644801fd5e8e266f26",null),(0,c.registerServerReference)(B,"40ab67729a516bd40da13c4fd3a3dd66541e3cd921",null),(0,c.registerServerReference)(C,"4064d53ba3761dbd97aa713e5347173dc36f87da72",null),a.s([],6560),a.i(6560),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00c868ee13674a1a9cfad57bee099d7292f9e67eb4",()=>s,"00e2f9ca752b1c30013dab093af07d0f14174aa264",()=>q,"4037342f17aaec0e31252dafd2a1e4260adf198bf6",()=>v,"403b0268c01a8d016ea3b0bd426a34770bc44f1125",()=>u,"4064d53ba3761dbd97aa713e5347173dc36f87da72",()=>C,"406a68d661855fda3bdabf4cbe336afdaf2a3ca3ea",()=>r,"4081dddf8d01a0fc8e3c2f11ef34dd1744b9d043b4",()=>x,"408ea785691725ca5c01424ed3e0bcf97036136166",()=>w,"40ab67729a516bd40da13c4fd3a3dd66541e3cd921",()=>B,"40bdb2869cbcb1084820438f29f810270689b32b93",()=>z,"6073314c494bb655a32b43b95cff425ad406173b3c",()=>y,"60f3ffb9732ccbf8aa15d6f1644801fd5e8e266f26",()=>A],2856)}];

//# sourceMappingURL=_342b5002._.js.map