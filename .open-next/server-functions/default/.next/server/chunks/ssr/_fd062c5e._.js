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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},30485,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259);async function e(){return(0,d.queryOne)(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1 LIMIT 1
  `)}async function f(a){return(0,d.query)(`
    SELECT DISTINCT m.id, m.nama
    FROM ehb_plotting_santri ps
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ?
    ORDER BY m.urutan
  `,[a])}async function g(a,b){let c=[a],e=b?"AND k.marhalah_id = ?":"";return b&&c.push(b),(0,d.query)(`
    SELECT DISTINCT k.id, k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? ${e}
    ORDER BY k.nama_kelas
  `,c)}async function h(a){return(0,d.query)(`
    SELECT
      s.id as santri_id,
      s.nama_lengkap,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      k.nama_kelas,
      COALESCE(s.asrama, '-') || ' / ' || COALESCE(s.kamar, '-') as asrama_kamar
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ?
    ORDER BY s.nama_lengkap
  `,[a])}async function i(a){return(0,d.query)(`
    SELECT DISTINCT r.id, r.nomor_ruangan
    FROM ehb_ruangan r
    JOIN ehb_plotting_santri ps ON ps.ruangan_id = r.id
    WHERE ps.ehb_event_id = ?
    ORDER BY r.nomor_ruangan
  `,[a])}async function j(a,b){let c=[a],e=b?"AND r.id = ?":"";return b&&c.push(b),(0,d.query)(`
    SELECT DISTINCT
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      r.nomor_ruangan,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE ps.ehb_event_id = ? ${e}
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `,c)}async function k(a,b){let c=[a],e="";if("marhalah"===b.type&&b.marhalahId)e="AND m.id = ?",c.push(b.marhalahId);else if("kelas"===b.type&&b.kelasId)e="AND k.id = ?",c.push(b.kelasId);else if("pilihan"===b.type&&b.santriIds&&b.santriIds.length>0){let a=b.santriIds.map(()=>"?").join(",");e=`AND s.id IN (${a})`,c.push(...b.santriIds)}return(0,d.query)(`
    SELECT
      ps.id,
      s.nama_lengkap,
      COALESCE(s.asrama, '-') || ' / ' || COALESCE(s.kamar, '-') as asrama_kamar,
      r.nomor_ruangan,
      ps.nomor_kursi,
      ps.jam_group,
      k.nama_kelas,
      k.id as kelas_id,
      m.id as marhalah_id,
      m.nama as marhalah_nama,
      e.nama as event_nama,
      e.semester,
      ta.nama as tahun_ajaran_nama,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ? ${e}
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `,c)}async function l(a,b){return(0,d.query)(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.kapasitas,
      ps.nomor_kursi,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      ps.jam_group,
      k.nama_kelas,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? AND ps.ruangan_id = ?
    ORDER BY ps.jam_group, ps.nomor_kursi
  `,[a,b])}async function m(a){return(0,d.query)(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.kapasitas,
      ps.nomor_kursi,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      ps.jam_group,
      k.nama_kelas,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ?
    ORDER BY r.nomor_ruangan, ps.jam_group, ps.nomor_kursi
  `,[a])}async function n(a){return(0,d.query)(`
    SELECT DISTINCT
      k.id as kelas_id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      m.urutan as marhalah_urutan
    FROM ehb_plotting_santri ps
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ?
    ORDER BY COALESCE(m.urutan, 999), k.nama_kelas
  `,[a])}async function o(a,b){let c=[a],e=b?"AND k.id = ?":"";return b&&c.push(b),(0,d.query)(`
    SELECT
      k.id as kelas_id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      m.urutan as marhalah_urutan,
      r.nomor_ruangan,
      COUNT(ps.id) as jumlah,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ? ${e}
    GROUP BY k.id, k.nama_kelas, m.nama, m.urutan, r.nomor_ruangan, e.semester, ta.nama
    ORDER BY COALESCE(m.urutan, 999), k.nama_kelas, r.nomor_ruangan
  `,c)}async function p(a,b){let c=[a],e=b?"AND r.id = ?":"";return b&&c.push(b),(0,d.query)(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      ps.jam_group,
      k.id as kelas_id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      m.urutan as marhalah_urutan,
      COUNT(ps.id) as jumlah,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ? ${e}
    GROUP BY r.id, r.nomor_ruangan, ps.jam_group, k.id, k.nama_kelas, m.nama, m.urutan, e.semester, ta.nama
    ORDER BY r.nomor_ruangan, ps.jam_group, COALESCE(m.urutan, 999), k.nama_kelas
  `,c)}async function q(a){return(0,d.query)(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.kapasitas,
      ps.jam_group,
      k.id as kelas_id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      m.urutan as marhalah_urutan,
      COUNT(ps.id) as jumlah,
      e.semester,
      ta.nama as tahun_ajaran_nama
    FROM ehb_plotting_santri ps
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    JOIN ehb_event e ON e.id = ps.ehb_event_id
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE ps.ehb_event_id = ?
    GROUP BY r.id, r.nomor_ruangan, r.kapasitas, ps.jam_group, k.id, k.nama_kelas, m.nama, m.urutan, e.semester, ta.nama
    ORDER BY ps.jam_group, r.nomor_ruangan, COALESCE(m.urutan, 999), k.nama_kelas
  `,[a])}async function r(a){return(0,d.query)(`
    SELECT DISTINCT jam_group 
    FROM ehb_plotting_santri 
    WHERE ehb_event_id = ? 
    ORDER BY jam_group
  `,[a])}async function s(a,b){return(0,d.query)(`
    SELECT DISTINCT tanggal, label
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    WHERE j.ehb_event_id = ? AND s.jam_group = ?
    ORDER BY tanggal, s.nomor_sesi
  `,[a,b])}async function t(a,b,c){return(0,d.query)(`
    SELECT
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? 
      AND ps.ruangan_id = ? 
      AND ps.jam_group = ?
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `,[a,b,c])}async function u(a,b){return(0,d.query)(`
    SELECT
      r.id as ruangan_id,
      r.nomor_ruangan,
      printf('%02d-%02d', r.nomor_ruangan, ps.nomor_kursi) as nomor_peserta,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      k.nama_kelas
    FROM ehb_plotting_santri ps
    JOIN santri s ON s.id = ps.santri_id
    JOIN ehb_ruangan r ON r.id = ps.ruangan_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ps.ehb_event_id = ? AND ps.jam_group = ?
    ORDER BY r.nomor_ruangan, ps.nomor_kursi
  `,[a,b])}async function v(a){let[b,c,e,f,g,h]=await Promise.all([(0,d.query)(`
      SELECT id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai
      FROM ehb_sesi
      WHERE ehb_event_id = ?
      ORDER BY nomor_sesi
    `,[a]),(0,d.query)(`
      SELECT DISTINCT tanggal
      FROM ehb_jadwal
      WHERE ehb_event_id = ?
      ORDER BY tanggal
    `,[a]),(0,d.query)(`
      SELECT DISTINCT tanggal, sesi_id
      FROM ehb_jadwal
      WHERE ehb_event_id = ?
      ORDER BY tanggal, sesi_id
    `,[a]),(0,d.query)(`
      SELECT id, nomor_ruangan, nama_ruangan
      FROM ehb_ruangan
      WHERE ehb_event_id = ?
      ORDER BY nomor_ruangan
    `,[a]),(0,d.query)(`
      SELECT
        jp.id,
        jp.tanggal,
        jp.sesi_id,
        s.nomor_sesi,
        jp.ruangan_id,
        r.nomor_ruangan,
        jp.pengawas_id,
        p.nama_pengawas,
        p.tag
      FROM ehb_jadwal_pengawas jp
      JOIN ehb_pengawas p ON p.id = jp.pengawas_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE jp.ehb_event_id = ?
      ORDER BY jp.tanggal, s.nomor_sesi, r.nomor_ruangan, p.nama_pengawas
    `,[a]),(0,d.query)(`
      SELECT id, nama_pengawas, tag
      FROM ehb_pengawas
      WHERE ehb_event_id = ?
      ORDER BY nama_pengawas
    `,[a])]);return{sesiList:b,tanggalList:c,activeSlots:e,ruanganList:f,jadwal:g,pengawasList:h}}async function w(a){let b=await (0,d.queryOne)(`
    SELECT e.id, e.nama, e.semester, e.tanggal_mulai, e.tanggal_selesai, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.id = ?
    LIMIT 1
  `,[a]),[c,e,f]=await Promise.all([(0,d.query)(`
      SELECT id, nomor_sesi, label, jam_group, waktu_mulai, waktu_selesai
      FROM ehb_sesi
      WHERE ehb_event_id = ?
      ORDER BY nomor_sesi
    `,[a]),(0,d.query)(`
      SELECT DISTINCT
        k.id,
        k.nama_kelas,
        m.nama as marhalah_nama,
        m.urutan as marhalah_urutan,
        kj.jam_group
      FROM ehb_kelas_jam kj
      JOIN kelas k ON k.id = kj.kelas_id
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE kj.ehb_event_id = ?
        AND m.nama NOT LIKE '%Mutaqaddimah%'
      ORDER BY m.urutan, k.nama_kelas
    `,[a]),(0,d.query)(`
      SELECT
        j.tanggal,
        j.sesi_id,
        j.kelas_id,
        COALESCE(kt.nama_kitab, mp.nama) as mapel_nama
      FROM ehb_jadwal j
      JOIN ehb_event e ON e.id = j.ehb_event_id
      JOIN ehb_sesi s ON s.id = j.sesi_id AND s.ehb_event_id = j.ehb_event_id
      JOIN ehb_kelas_jam kj
        ON kj.ehb_event_id = j.ehb_event_id
       AND kj.kelas_id = j.kelas_id
       AND INSTR(',' || REPLACE(s.jam_group, ' ', '') || ',', ',' || REPLACE(kj.jam_group, ' ', '') || ',') > 0
      JOIN kelas k ON k.id = j.kelas_id
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      JOIN marhalah m ON m.id = k.marhalah_id
      JOIN mapel mp ON mp.id = j.mapel_id
      LEFT JOIN kitab kt
        ON kt.mapel_id = j.mapel_id
       AND kt.marhalah_id = k.marhalah_id
       AND kt.tahun_ajaran_id = e.tahun_ajaran_id
      WHERE j.ehb_event_id = ?
        AND m.nama NOT LIKE '%Mutaqaddimah%'
      ORDER BY j.tanggal, s.nomor_sesi, m.urutan, k.nama_kelas
    `,[a])]),g={ketua:"",sekretaris:""};try{let b=await (0,d.query)(`
      SELECT jabatan_key, nama
      FROM ehb_panitia
      WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key IN ('ketua', 'sekretaris')
    `,[a]);g={ketua:b.find(a=>"ketua"===a.jabatan_key)?.nama??"",sekretaris:b.find(a=>"sekretaris"===a.jabatan_key)?.nama??""}}catch{g={ketua:"",sekretaris:""}}return{event:b,sesiList:c,kelasList:e,jadwal:f,panitia:g}}(0,a.i(13095).ensureServerEntryExports)([e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w]),(0,c.registerServerReference)(e,"00efdd3b8b0858ef22bae4a777bf62ddb29d62c711",null),(0,c.registerServerReference)(f,"40ac5e6b69bbf2e8038c26ab682f47f2111284fb19",null),(0,c.registerServerReference)(g,"607f21c955c18fdf24fd8ddb9dca0ba49178940859",null),(0,c.registerServerReference)(h,"409278119e135657ebf7b1cd21e29603600513ff5c",null),(0,c.registerServerReference)(i,"40841b52ee11a716a3a0c4da8c109b770e1a8b4f2e",null),(0,c.registerServerReference)(j,"60352054f3a248f0e2688ad45468d3a71ecd61163b",null),(0,c.registerServerReference)(k,"60acf82911c312c1c9c8a76e801f279949fccc4b9b",null),(0,c.registerServerReference)(l,"60ccdb7d87a7717dbeb15da5b8ccf03818286a662a",null),(0,c.registerServerReference)(m,"40987ced9871060e19826845c155ef17b14fbfc872",null),(0,c.registerServerReference)(n,"4045f345c9a3b31810b5676b47061d8fdb32b66d17",null),(0,c.registerServerReference)(o,"60a89bb3d0defce3cc295b042eb18e1c4588f53521",null),(0,c.registerServerReference)(p,"6021b0c223ea23a01981ac653f18bca57d150d206d",null),(0,c.registerServerReference)(q,"40c8dc9ab281b05b012e04ce288bd5d6f235388c41",null),(0,c.registerServerReference)(r,"4071e3364846c09d000821a004ed2cff684476a615",null),(0,c.registerServerReference)(s,"6003b32412bbb332066cb9675572a213ee756b4524",null),(0,c.registerServerReference)(t,"7047b3c377511f51f7a3367731fa527172ea76fe32",null),(0,c.registerServerReference)(u,"6033ca6eb762827d37e667aca7d95419418e00e5e0",null),(0,c.registerServerReference)(v,"401d537b56d3578d09b14275af83d890f415ae037e",null),(0,c.registerServerReference)(w,"40e57140ab33b1e6f26b9e8ba10a66aa8aec0f750e",null),a.s([],67716),a.i(67716),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00efdd3b8b0858ef22bae4a777bf62ddb29d62c711",()=>e,"401d537b56d3578d09b14275af83d890f415ae037e",()=>v,"4045f345c9a3b31810b5676b47061d8fdb32b66d17",()=>n,"4071e3364846c09d000821a004ed2cff684476a615",()=>r,"40841b52ee11a716a3a0c4da8c109b770e1a8b4f2e",()=>i,"409278119e135657ebf7b1cd21e29603600513ff5c",()=>h,"40987ced9871060e19826845c155ef17b14fbfc872",()=>m,"40ac5e6b69bbf2e8038c26ab682f47f2111284fb19",()=>f,"40c8dc9ab281b05b012e04ce288bd5d6f235388c41",()=>q,"40e57140ab33b1e6f26b9e8ba10a66aa8aec0f750e",()=>w,"6003b32412bbb332066cb9675572a213ee756b4524",()=>s,"6021b0c223ea23a01981ac653f18bca57d150d206d",()=>p,"6033ca6eb762827d37e667aca7d95419418e00e5e0",()=>u,"60352054f3a248f0e2688ad45468d3a71ecd61163b",()=>j,"607f21c955c18fdf24fd8ddb9dca0ba49178940859",()=>g,"60a89bb3d0defce3cc295b042eb18e1c4588f53521",()=>o,"60acf82911c312c1c9c8a76e801f279949fccc4b9b",()=>k,"60ccdb7d87a7717dbeb15da5b8ccf03818286a662a",()=>l,"7047b3c377511f51f7a3367731fa527172ea76fe32",()=>t],30485)}];

//# sourceMappingURL=_fd062c5e._.js.map