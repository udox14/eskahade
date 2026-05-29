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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},60487,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/asrama/absen-sakit";async function j(){for(let a of["ALTER TABLE absen_sakit ADD COLUMN sesi TEXT NOT NULL DEFAULT 'PAGI'","ALTER TABLE absen_sakit ADD COLUMN sakit_apa TEXT","ALTER TABLE absen_sakit ADD COLUMN beli_surat INTEGER NOT NULL DEFAULT 0","ALTER TABLE absen_sakit ADD COLUMN nomor_surat_sakit TEXT","ALTER TABLE absen_sakit ADD COLUMN updated_at TEXT","ALTER TABLE absen_sakit ADD COLUMN episode_id TEXT","ALTER TABLE absen_sakit ADD COLUMN status_sakit TEXT NOT NULL DEFAULT 'SAKIT'","ALTER TABLE absen_sakit ADD COLUMN mulai_at TEXT","ALTER TABLE absen_sakit ADD COLUMN sembuh_at TEXT"])try{await (0,d.execute)(a)}catch{}await (0,d.execute)("UPDATE absen_sakit SET episode_id = id WHERE episode_id IS NULL OR episode_id = ''"),await (0,d.execute)("UPDATE absen_sakit SET mulai_at = COALESCE(mulai_at, tanggal || 'T00:00:00.000Z') WHERE mulai_at IS NULL OR mulai_at = ''")}async function k(){let a=await (0,e.getSession)();return a&&(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null}async function l(){let a=await (0,e.getSession)();return a&&(0,e.hasAnyRole)(a,["admin","pengurus_asrama"])?a:null}function m(a){return"SORE"===a||"MALAM"===a?a:"PAGI"}function n(a){return/^\d{4}-\d{2}-\d{2}$/.test(a)?a:new Date().toISOString().split("T")[0]}function o(a){let b=new Date(a);return Number.isNaN(b.getTime())?new Date:b}async function p(){let a=await (0,e.getSession)();return a?{role:a.role,asrama_binaan:(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null,isAdmin:(0,e.isAdmin)(a)}:null}async function q(){let a=await k();return a?[a]:(await (0,d.query)(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE asrama IS NOT NULL AND asrama != ''
    ORDER BY asrama
  `)).map(a=>a.asrama)}async function r(a,b){if(!await l())return[];let c=a.trim();if(c.length<2)return[];let e=await k();return(0,d.query)(`
    SELECT id, nama_lengkap, nis, kamar, asrama, foto_url
    FROM santri
    WHERE asrama = ?
      AND status_global = 'aktif'
      AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
    LIMIT 12
  `,[e||b,`%${c}%`,`%${c}%`])}async function s(a){if(await j(),!await l())return[];let b=await k()||a.asrama;return(0,d.query)(`
    WITH latest AS (
      SELECT COALESCE(episode_id, id) AS episode_key, MAX(created_at) AS max_created_at
      FROM absen_sakit
      GROUP BY COALESCE(episode_id, id)
    ),
    closed AS (
      SELECT DISTINCT COALESCE(episode_id, id) AS episode_key
      FROM absen_sakit
      WHERE status_sakit = 'SEMBUH' OR sembuh_at IS NOT NULL
    )
    SELECT
      ab.id,
      COALESCE(ab.episode_id, ab.id) AS episode_id,
      ab.santri_id,
      ab.tanggal,
      COALESCE(ab.sesi, 'PAGI') AS sesi,
      COALESCE(
        NULLIF(ab.sakit_apa, ''),
        CASE WHEN ab.keterangan IN ('BELI_SURAT', 'TIDAK_BELI') THEN NULL ELSE ab.keterangan END,
        '-'
      ) AS sakit_apa,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN 1
        ELSE 0
      END AS beli_surat,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN NULLIF(ab.nomor_surat_sakit, '')
        ELSE NULL
      END AS nomor_surat_sakit,
      COALESCE(ab.status_sakit, 'SAKIT') AS status_sakit,
      ab.mulai_at,
      ab.sembuh_at,
      ab.created_at,
      ab.updated_at,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      s.asrama,
      s.foto_url
    FROM absen_sakit ab
    JOIN latest l ON l.episode_key = COALESCE(ab.episode_id, ab.id) AND l.max_created_at = ab.created_at
    JOIN santri s ON s.id = ab.santri_id
    LEFT JOIN closed c ON c.episode_key = COALESCE(ab.episode_id, ab.id)
    WHERE s.asrama = ?
      AND c.episode_key IS NULL
    ORDER BY COALESCE(ab.mulai_at, ab.created_at) DESC, s.kamar, s.nama_lengkap
  `,[b])}async function t(a){await j();let b=await l();if(!b)return{error:"Unauthorized"};let c=a.sakitApa.trim();if(!c)return{error:"Isi dulu sakitnya apa."};let e=await k(),h=await (0,d.queryOne)(`
    SELECT id, asrama, nama_lengkap
    FROM santri
    WHERE id = ? AND status_global = 'aktif'
  `,[a.santriId]);if(!h)return{error:"Santri tidak ditemukan."};if(e&&h.asrama!==e)return{error:"Pengurus asrama hanya bisa mendata santri asramanya."};let p=n(a.tanggal),q=m(a.sesi),r=o(a.mulaiAt).toISOString(),s=+!!a.beliSurat,t=s?(a.nomorSuratSakit||"").trim():"";if(s&&!t)return{error:"Isi dulu nomor surat sakit."};let u=await (0,d.queryOne)(`
    WITH closed AS (
      SELECT DISTINCT COALESCE(episode_id, id) AS episode_key
      FROM absen_sakit
      WHERE status_sakit = 'SEMBUH' OR sembuh_at IS NOT NULL
    )
    SELECT COALESCE(ab.episode_id, ab.id) AS episode_id, ab.mulai_at
    FROM absen_sakit ab
    LEFT JOIN closed c ON c.episode_key = COALESCE(ab.episode_id, ab.id)
    WHERE ab.santri_id = ? AND c.episode_key IS NULL
    ORDER BY COALESCE(ab.mulai_at, ab.created_at) DESC
    LIMIT 1
  `,[a.santriId]),v=(0,d.generateId)(),w=u?.episode_id||v,x=u?.mulai_at||r;return u?await (0,d.execute)(`
      INSERT INTO absen_sakit
        (id, episode_id, santri_id, tanggal, sesi, sakit_apa, beli_surat, nomor_surat_sakit, keterangan, status_sakit, mulai_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SAKIT', ?, ?)
    `,[v,w,a.santriId,p,q,c,s,t||null,c,x,b.id??null]):await (0,d.execute)(`
      INSERT INTO absen_sakit
        (id, episode_id, santri_id, tanggal, sesi, sakit_apa, beli_surat, nomor_surat_sakit, keterangan, status_sakit, mulai_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SAKIT', ?, ?)
    `,[v,w,a.santriId,p,q,c,s,t||null,c,r,b.id??null]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_absen_sakit",action:u?"update":"create",fiturHref:i,logKind:u?"update":"create",entityType:"absen_sakit",entityId:w,entityLabel:h.nama_lengkap,summary:`${u?"Memperbarui":"Mencatat"} sakit santri ${h.nama_lengkap}`,details:{tanggal:p,sesi:q,sakit_apa:c,beli_surat:!!s,nomor_surat_sakit:t||null,mulai_at:u?x:r}}),(0,g.revalidatePath)(i),{success:!0,updated:!!u,nama:h.nama_lengkap}}async function u(a){await j();let b=await l();if(!b)return{error:"Unauthorized"};let c=await k(),e=await (0,d.queryOne)(`
    SELECT
      COALESCE(ab.episode_id, ab.id) AS episode_id,
      ab.santri_id,
      s.asrama,
      ab.sakit_apa,
      ab.beli_surat,
      ab.nomor_surat_sakit,
      ab.mulai_at
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    WHERE COALESCE(ab.episode_id, ab.id) = ?
    ORDER BY ab.created_at DESC
    LIMIT 1
  `,[a.episodeId]);if(!e)return{error:"Data sakit tidak ditemukan."};if(c&&e.asrama!==c)return{error:"Pengurus asrama hanya bisa mengubah data santri asramanya."};let h=n(a.tanggal),p=m(a.sesi),q=o(a.sembuhAt).toISOString();await (0,d.execute)(`
    INSERT INTO absen_sakit
      (id, episode_id, santri_id, tanggal, sesi, sakit_apa, beli_surat, nomor_surat_sakit, keterangan, status_sakit, mulai_at, sembuh_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Sembuh', 'SEMBUH', ?, ?, ?)
  `,[(0,d.generateId)(),e.episode_id,e.santri_id,h,p,e.sakit_apa||"Sembuh",e.beli_surat||0,e.beli_surat?e.nomor_surat_sakit:null,e.mulai_at,q,b.id??null]);let r=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[e.santri_id]);return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_absen_sakit",action:"update",fiturHref:i,logKind:"update",entityType:"absen_sakit",entityId:e.episode_id,entityLabel:r?.nama_lengkap||e.santri_id,summary:`Menandai sembuh santri ${r?.nama_lengkap||e.santri_id}`,details:{tanggal:h,sesi:p,sembuh_at:q}}),(0,g.revalidatePath)(i),{success:!0}}async function v(a){await j();let b=await l();if(!b)return{error:"Unauthorized"};let c=await (0,d.queryOne)(`
    SELECT
      COALESCE(ab.episode_id, ab.id) AS episode_id,
      ab.santri_id,
      s.asrama,
      s.nama_lengkap
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    WHERE COALESCE(ab.episode_id, ab.id) = ?
    ORDER BY ab.created_at DESC
    LIMIT 1
  `,[a.episodeId]);if(!c)return{error:"Data sakit tidak ditemukan."};let e=await k();return e&&c.asrama!==e?{error:"Pengurus asrama hanya bisa menghapus data santri asramanya."}:(await (0,d.execute)(`
    DELETE FROM absen_sakit
    WHERE COALESCE(episode_id, id) = ?
  `,[c.episode_id]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_absen_sakit",action:"delete",fiturHref:i,logKind:"delete",entityType:"absen_sakit",entityId:c.episode_id,entityLabel:c.nama_lengkap,summary:`Menghapus riwayat sakit santri ${c.nama_lengkap}`,details:{santri_id:c.santri_id,asrama:c.asrama}}),(0,g.revalidatePath)(i),{success:!0,nama:c.nama_lengkap})}async function w(a){if(await j(),!await l())return[];let b=await k(),c=await (0,d.queryOne)("SELECT asrama FROM santri WHERE id = ?",[a]);return!c||b&&c.asrama!==b?[]:(0,d.query)(`
    SELECT
      ab.id,
      COALESCE(ab.episode_id, ab.id) AS episode_id,
      ab.santri_id,
      ab.tanggal,
      COALESCE(ab.sesi, 'PAGI') AS sesi,
      COALESCE(
        NULLIF(ab.sakit_apa, ''),
        CASE WHEN ab.keterangan IN ('BELI_SURAT', 'TIDAK_BELI') THEN NULL ELSE ab.keterangan END,
        '-'
      ) AS sakit_apa,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN 1
        ELSE 0
      END AS beli_surat,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN NULLIF(ab.nomor_surat_sakit, '')
        ELSE NULL
      END AS nomor_surat_sakit,
      COALESCE(ab.status_sakit, 'SAKIT') AS status_sakit,
      ab.mulai_at,
      ab.sembuh_at,
      ab.created_at,
      ab.updated_at,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      s.asrama,
      u.name AS pencatat_nama
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    LEFT JOIN users u ON u.id = ab.created_by
    WHERE ab.santri_id = ?
    ORDER BY ab.tanggal DESC,
      CASE COALESCE(ab.sesi, 'PAGI')
        WHEN 'MALAM' THEN 3
        WHEN 'SORE' THEN 2
        ELSE 1
      END DESC,
      ab.created_at DESC
    LIMIT 80
  `,[a])}(0,h.ensureServerEntryExports)([p,q,r,s,t,u,v,w]),(0,c.registerServerReference)(p,"00b35ba69f803c5f36d8a7a498eb12b3f361389808",null),(0,c.registerServerReference)(q,"002c4cf54402884f9c8ca28963fa825bedbc64d5c7",null),(0,c.registerServerReference)(r,"606aa0615ac2512f1c9845b82786654896cd406987",null),(0,c.registerServerReference)(s,"408409bb33b6015f245db52232ef231c557f75e1b6",null),(0,c.registerServerReference)(t,"40e10bbca00964bb19fe1ae1698cc58e2c65885c07",null),(0,c.registerServerReference)(u,"40068ae2d17d08af9e29a934dc5ca8593986810bef",null),(0,c.registerServerReference)(v,"408e50283b8f25033a113d045ebd7120016cd24b42",null),(0,c.registerServerReference)(w,"407761baa17ae32621a19b9931727bb9416112b0f0",null),a.s([],60112),a.i(60112),a.s(["002c4cf54402884f9c8ca28963fa825bedbc64d5c7",()=>q,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00b35ba69f803c5f36d8a7a498eb12b3f361389808",()=>p,"40068ae2d17d08af9e29a934dc5ca8593986810bef",()=>u,"407761baa17ae32621a19b9931727bb9416112b0f0",()=>w,"408409bb33b6015f245db52232ef231c557f75e1b6",()=>s,"40e10bbca00964bb19fe1ae1698cc58e2c65885c07",()=>t,"606aa0615ac2512f1c9845b82786654896cd406987",()=>r],60487)}];

//# sourceMappingURL=_0e3862c5._.js.map