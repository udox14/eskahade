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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},85972,a=>{"use strict";var b=a.i(12259);let c=["REGULER","SADESA"],d=["BARU",...c],e="santri_baru_mulai_berlaku",f="santri_baru_durasi_bulan",g="2026-07-01";function h(a){return"SADESA"===String(a??"").trim().toUpperCase()?"SADESA":"REGULER"}function i(a="s"){let b=`(SELECT value FROM app_settings WHERE key = '${e}')`,c=`(SELECT value FROM app_settings WHERE key = '${f}')`;return`CASE
    WHEN ${a}.status_global = 'aktif'
      AND ${a}.created_at IS NOT NULL
      AND date(${a}.created_at) >= date(COALESCE(${b}, '${g}'))
      AND datetime(${a}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${c}, '3') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${a}.kategori_santri, ''), 'REGULER')
  END`}async function j(){await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[e,g]),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[f,String(3)])}async function k(){await j();let[a,c]=await Promise.all([(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[e]),(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[f])]);return{mulaiBerlaku:l(a?.value),durasiBulan:m(c?.value)}}function l(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:g}function m(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}a.s(["KATEGORI_SANTRI_DASAR",0,c,"KATEGORI_SANTRI_EFEKTIF",0,d,"SANTRI_BARU_DURASI_KEY",0,f,"SANTRI_BARU_MULAI_KEY",0,e,"getKategoriSantriEfektifSql",()=>i,"getSantriBaruSettings",()=>k,"normalizeDurasiBulan",()=>m,"normalizeKategoriSantriDasar",()=>h,"normalizeMulaiBerlaku",()=>l])},24563,a=>{"use strict";var b=a.i(37936),c=a.i(18558),d=a.i(6846),e=a.i(4552),f=a.i(53058),g=a.i(12259),h=a.i(85972),i=a.i(13095);let j="/dashboard/setup-tahun-ajaran",k=[{key:"tahun_ajaran",title:"Tahun Ajaran Aktif",description:"Pastikan tahun ajaran baru sudah dibuat dan diaktifkan.",href:"/dashboard/pengaturan/tahun-ajaran",group:"Fondasi"},{key:"masa_santri_baru",title:"Masa Santri Baru",description:"Atur tanggal mulai dan durasi label BARU untuk santri tahun ini.",href:"/dashboard/pengaturan/santri-baru",group:"Santri Baru"},{key:"tarif_santri_baru",title:"Tarif Santri Baru",description:"Lengkapi tarif bangunan, kesehatan, EHB, dan ekskul untuk angkatan baru.",href:"/dashboard/keuangan/tarif",group:"Keuangan"},{key:"kelas_tahun_ajaran",title:"Kelas Tahun Ajaran",description:"Siapkan daftar kelas aktif beserta marhalah dan jenis kelaminnya.",href:"/dashboard/master/kelas",group:"Akademik"},{key:"penempatan_kelas",title:"Kenaikan & Penempatan Kelas",description:"Pastikan semua santri aktif sudah punya kelas di tahun ajaran aktif.",href:"/dashboard/santri/atur-kelas",group:"Akademik"},{key:"tes_klasifikasi",title:"Tes Klasifikasi Santri Baru",description:"Lengkapi hasil tes untuk santri baru yang belum ditempatkan ke kelas.",href:"/dashboard/santri/tes-klasifikasi",group:"Santri Baru"},{key:"guru_jadwal",title:"Guru, Wali Kelas, dan Jadwal",description:"Lengkapi wali kelas dan guru default shubuh, ashar, maghrib untuk tiap kelas.",href:"/dashboard/master/wali-kelas",group:"Akademik"},{key:"flow_psb",title:"Flow PSB",description:"Pastikan santri baru tahun berjalan tidak tertahan di alur PSB.",href:"/dashboard/psb",group:"PSB"}];async function l(){await (0,g.execute)(`
    CREATE TABLE IF NOT EXISTS setup_wizard_overrides (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      tahun_ajaran_id  INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      item_key         TEXT NOT NULL,
      status           TEXT NOT NULL CHECK(status IN ('complete', 'skipped')),
      note             TEXT,
      updated_by       TEXT REFERENCES users(id),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tahun_ajaran_id, item_key)
    )
  `),await (0,g.execute)(`
    CREATE INDEX IF NOT EXISTS idx_setup_wizard_overrides_tahun
    ON setup_wizard_overrides(tahun_ajaran_id)
  `),await (0,g.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('Master Data', 'Setup Tahun Ajaran', ?, 'ClipboardList', '["admin"]', 1, 2)
  `,[j])}function m(a,b){return{autoStatus:"complete",total:a,completed:a,detail:b}}function n(a,b=0){return{autoStatus:"not_started",total:b,completed:0,detail:a}}function o(a,b,c){return{autoStatus:"needs_review",total:a,completed:b,detail:c}}async function p(a){if(!a)return n("Nama tahun ajaran belum memuat tahun awal yang bisa dibaca.");let b=await (0,h.getSantriBaruSettings)();return Number(b.mulaiBerlaku.slice(0,4))===a&&b.durasiBulan>0?m(1,`Mulai ${b.mulaiBerlaku}, durasi ${b.durasiBulan} bulan.`):o(1,0,`Mulai berlaku masih ${b.mulaiBerlaku}; sebaiknya berada di tahun ${a}.`)}async function q(a){if(!a)return n("Tahun angkatan belum bisa ditentukan dari nama tahun ajaran.");let b=["BANGUNAN","KESEHATAN","EHB","EKSKUL"],c=(await (0,g.query)(`SELECT jenis_biaya, nominal
     FROM biaya_settings
     WHERE tahun_angkatan = ? AND jenis_biaya IN (${b.map(()=>"?").join(",")})`,[a,...b])).filter(a=>b.includes(a.jenis_biaya)&&Number(a.nominal)>0);if(c.length===b.length)return m(b.length,`Semua tarif angkatan ${a} sudah diisi.`);let d=b.filter(a=>!c.some(b=>b.jenis_biaya===a));return 0===c.length?n(`Belum ada tarif lengkap untuk angkatan ${a}.`,b.length):o(b.length,c.length,`Kurang tarif: ${d.join(", ")}.`)}async function r(a){let b=await (0,g.queryOne)(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN TRIM(COALESCE(nama_kelas, '')) != ''
         AND marhalah_id IS NOT NULL
         AND TRIM(COALESCE(jenis_kelamin, '')) != ''
        THEN 1 ELSE 0 END) AS lengkap
    FROM kelas
    WHERE tahun_ajaran_id = ?
  `,[a]),c=Number(b?.total??0),d=Number(b?.lengkap??0);return 0===c?n("Belum ada kelas untuk tahun ajaran aktif."):d===c?m(c,`${c} kelas aktif sudah lengkap.`):o(c,d,`${c-d} dari ${c} kelas masih kurang data dasar.`)}async function s(a){let b=await (0,g.queryOne)(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN EXISTS (
        SELECT 1
        FROM riwayat_pendidikan rp
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE rp.santri_id = s.id
          AND rp.status_riwayat = 'aktif'
          AND k.tahun_ajaran_id = ?
      ) THEN 1 ELSE 0 END) AS ditempatkan
    FROM santri s
    WHERE s.status_global = 'aktif'
  `,[a]),c=Number(b?.total??0),d=Number(b?.ditempatkan??0);return 0===c?n("Belum ada santri aktif."):d===c?m(c,`${c} santri aktif sudah berada di kelas tahun ajaran aktif.`):o(c,d,`${c-d} santri aktif belum punya kelas tahun ajaran aktif.`)}async function t(){try{let a=await (0,g.queryOne)(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END) AS sudah
      FROM santri s
      LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND NOT EXISTS (
          SELECT 1 FROM riwayat_pendidikan rp WHERE rp.santri_id = s.id
        )
    `),b=Number(a?.total??0),c=Number(a?.sudah??0);if(0===b)return m(1,"Tidak ada santri baru yang menunggu tes klasifikasi.");if(c===b)return m(b,`${b} santri baru sudah punya hasil tes.`);return o(b,c,`${b-c} santri baru belum punya hasil tes.`)}catch{return o(1,0,"Data tes klasifikasi belum siap dibaca. Cek halaman tes klasifikasi.")}}async function u(a){let b=await (0,g.queryOne)(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN wali_kelas_id IS NOT NULL
         AND guru_shubuh_id IS NOT NULL
         AND guru_ashar_id IS NOT NULL
         AND guru_maghrib_id IS NOT NULL
        THEN 1 ELSE 0 END) AS lengkap
    FROM kelas
    WHERE tahun_ajaran_id = ?
  `,[a]),c=Number(b?.total??0),d=Number(b?.lengkap??0);return 0===c?n("Belum ada kelas aktif untuk diatur guru dan wali kelasnya."):d===c?m(c,`${c} kelas sudah punya wali kelas dan guru default.`):o(c,d,`${c-d} kelas belum lengkap wali kelas atau guru defaultnya.`)}async function v(a){if(!a)return n("Tahun PSB belum bisa ditentukan dari nama tahun ajaran.");try{let b=await (0,g.queryOne)(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN COALESCE(pf.status, 'VERIFICATION') = 'DONE' THEN 1 ELSE 0 END) AS selesai
      FROM santri s
      LEFT JOIN psb_flow pf ON pf.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND (
          s.tahun_masuk = ?
          OR (s.tahun_masuk IS NULL AND strftime('%Y', s.created_at) = ?)
          OR pf.id IS NOT NULL
        )
        AND (s.tahun_masuk = ? OR strftime('%Y', s.created_at) = ?)
    `,[a,String(a),a,String(a)]),c=Number(b?.total??0),d=Number(b?.selesai??0);if(0===c)return m(1,`Tidak ada data PSB untuk tahun ${a}.`);if(d===c)return m(c,`${c} santri PSB tahun ${a} sudah DONE.`);return o(c,d,`${c-d} santri PSB tahun ${a} belum DONE.`)}catch{return m(1,`Belum ada flow PSB terbaca untuk tahun ${a}.`)}}async function w(a,b,c){return"tahun_ajaran"===a?b?m(1,`Tahun ajaran aktif: ${b.nama}.`):n("Belum ada tahun ajaran aktif."):b?"masa_santri_baru"===a?p(c):"tarif_santri_baru"===a?q(c):"kelas_tahun_ajaran"===a?r(b.id):"penempatan_kelas"===a?s(b.id):"tes_klasifikasi"===a?t():"guru_jadwal"===a?u(b.id):"flow_psb"===a?v(c):n("Belum ada pemeriksaan otomatis."):n("Menunggu tahun ajaran aktif.")}async function x(){let a=await (0,e.assertFeature)(j);return"error"in a||(0,f.isAdmin)(a)?a:{error:"Akses ditolak"}}async function y(){let a,b=await x();if("error"in b)return b;await l();let c=await (0,g.queryOne)("SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),d=(a=String(c?.nama??"").match(/\b(20\d{2})\b/))?Number(a[1]):null,e=new Map((c?await (0,g.query)("SELECT item_key, status, note, updated_at FROM setup_wizard_overrides WHERE tahun_ajaran_id = ?",[c.id]):[]).map(a=>[a.item_key,a])),f=await Promise.all(k.map(async a=>{var b;let f=await w(a.key,c,d),g=e.get(a.key)??null;return{...a,returnHref:(b=a.href,`${b}?returnTo=${encodeURIComponent("/dashboard/setup-tahun-ajaran")}`),locked:"tahun_ajaran"!==a.key&&!c,status:g?.status??f.autoStatus,autoStatus:f.autoStatus,detail:f.detail,total:f.total??0,completed:f.completed??0,override:g?{status:g.status,note:g.note,updated_at:g.updated_at}:null}})),h=f.filter(a=>"complete"===a.status||"skipped"===a.status).length;return{tahunAjaran:c,tahunAwal:d,progress:{total:f.length,done:h,percent:f.length?Math.round(h/f.length*100):0},items:f}}async function z(a){let b=await x();if("error"in b)return b;await l();let e=k.find(b=>b.key===a.itemKey);if(!e)return{error:"Item setup tidak ditemukan."};if(!["complete","skipped"].includes(a.status))return{error:"Status override tidak valid."};let f=await (0,g.queryOne)("SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1");if(!f)return{error:"Aktifkan tahun ajaran terlebih dahulu."};let h=String(a.note??"").trim()||null;return await (0,g.execute)(`
    INSERT INTO setup_wizard_overrides (tahun_ajaran_id, item_key, status, note, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(tahun_ajaran_id, item_key) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `,[f.id,a.itemKey,a.status,h,b.id]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(b),module:"setup_tahun_ajaran",action:"update",fiturHref:j,logKind:"update",entityType:"setup_wizard_override",entityId:`${f.id}:${a.itemKey}`,entityLabel:e.title,summary:`Override setup ${e.title} menjadi ${"complete"===a.status?"selesai":"dilewati"}`,details:{tahun_ajaran:f.nama,status:a.status,note:h}}),(0,c.revalidatePath)(j),{success:!0}}async function A(a){let b=await x();if("error"in b)return b;await l();let e=await (0,g.queryOne)("SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1");return e?(await (0,g.execute)("DELETE FROM setup_wizard_overrides WHERE tahun_ajaran_id = ? AND item_key = ?",[e.id,a]),await (0,d.logActivity)({actor:(0,d.actorFromSession)(b),module:"setup_tahun_ajaran",action:"delete",fiturHref:j,logKind:"delete",entityType:"setup_wizard_override",entityId:`${e.id}:${a}`,entityLabel:a,summary:"Menghapus override setup tahun ajaran",details:{tahun_ajaran:e.nama,item_key:a}}),(0,c.revalidatePath)(j),{success:!0}):{error:"Aktifkan tahun ajaran terlebih dahulu."}}(0,i.ensureServerEntryExports)([y,z,A]),(0,b.registerServerReference)(y,"001b1027d900cbb4e9a38d4032368478fcc4f102bb",null),(0,b.registerServerReference)(z,"408374abadc7728e6d3b26ba4265761375d5ed3426",null),(0,b.registerServerReference)(A,"40da29786bb123651c1eddfda4396cf5f01d60b510",null),a.s(["clearSetupWizardOverride",()=>A,"getSetupTahunAjaranState",()=>y,"saveSetupWizardOverride",()=>z])},63756,a=>{"use strict";var b=a.i(24895),c=a.i(24563);a.s([],95524),a.i(95524),a.s(["001b1027d900cbb4e9a38d4032368478fcc4f102bb",()=>c.getSetupTahunAjaranState,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"408374abadc7728e6d3b26ba4265761375d5ed3426",()=>c.saveSetupWizardOverride,"40da29786bb123651c1eddfda4396cf5f01d60b510",()=>c.clearSetupWizardOverride],63756)}];

//# sourceMappingURL=_fdac2abc._.js.map