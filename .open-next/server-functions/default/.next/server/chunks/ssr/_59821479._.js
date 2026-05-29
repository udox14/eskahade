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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},44453,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(9343),i=a.i(13095);let j=["shubuh","ashar","maghrib"];async function k(){try{await (0,d.execute)(`
      CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
        tanggal    TEXT NOT NULL,
        sesi       TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (tanggal, sesi)
      )
    `)}catch{}}function l(a){let b=new Date(a),c=b.getDay();b.setDate(b.getDate()-((c<3?c+7:c)-3)),b.setHours(0,0,0,0);let d=new Date(b),e=new Date(b);return e.setDate(e.getDate()+6),{start:d,end:e}}async function m(a,b){await k();let{start:c,end:e}=l(new Date(a)),f=c.toISOString().split("T")[0],g=e.toISOString().split("T")[0],h=["rp.status_riwayat = 'aktif'","s.status_global = 'aktif'"],i=[];b.kelasId&&(h.push("rp.kelas_id = ?"),i.push(b.kelasId)),b.asrama&&(h.push("s.asrama = ?"),i.push(b.asrama)),b.marhalahId&&(h.push("k.marhalah_id = ?"),i.push(b.marhalahId));let j=h.join(" AND "),m=await (0,d.query)(`
    SELECT 
      rp.id, 
      s.id AS santri_id, 
      s.nama_lengkap, 
      s.nis,
      s.asrama,
      s.kamar,
      s.sekolah,
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${j}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC, s.nis ASC
  `,i);return m.length?{santri:m,absensi:await (0,d.query)(`
    SELECT ah.riwayat_pendidikan_id, ah.tanggal, ah.shubuh, ah.ashar, ah.maghrib
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${j}
      AND ah.tanggal >= ? AND ah.tanggal <= ?
  `,[...i,f,g]),libur:await (0,d.query)(`
    SELECT tanggal, sesi
    FROM pengajian_libur_sesi
    WHERE tanggal >= ? AND tanggal <= ?
  `,[f,g])}:{santri:[],absensi:[]}}async function n(a,b=[]){await k();let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};if(!a.length&&!b.length)return{success:!0};let h=[];for(let b of a){let a=a=>{let b=String(a||"H").toUpperCase();return"A"===b||"S"===b||"I"===b?b:"H"},e=a(b.shubuh),f=a(b.ashar),g=a(b.maghrib);"H"===e&&"H"===f&&"H"===g?h.push({sql:"DELETE FROM absensi_harian WHERE riwayat_pendidikan_id = ? AND tanggal = ?",params:[b.riwayat_id,b.tanggal]}):h.push({sql:`INSERT INTO absensi_harian (id, riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(riwayat_pendidikan_id, tanggal) DO UPDATE SET
                shubuh = excluded.shubuh,
                ashar = excluded.ashar,
                maghrib = excluded.maghrib,
                created_by = excluded.created_by`,params:[(0,d.generateId)(),b.riwayat_id,b.tanggal,e,f,g,c.id]})}let i=new Map;b.forEach(a=>{a?.tanggal&&j.includes(a.sesi)&&i.set(`${a.tanggal}-${a.sesi}`,a)});let l=Array.from(i.values()).map(a=>a.is_libur?{sql:`INSERT INTO pengajian_libur_sesi (tanggal, sesi, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tanggal, sesi) DO UPDATE SET updated_at = excluded.updated_at`,params:[a.tanggal,a.sesi,c.id,(0,d.now)(),(0,d.now)()]}:{sql:"DELETE FROM pengajian_libur_sesi WHERE tanggal = ? AND sesi = ?",params:[a.tanggal,a.sesi]});try{for(let a=0;a<h.length;a+=50)await (0,d.batch)(h.slice(a,a+50));if(l.length>0)for(let a=0;a<l.length;a+=50)await (0,d.batch)(l.slice(a,a+50));let e=b.filter(a=>a?.is_libur).length;return await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_absensi",action:"update",fiturHref:"/dashboard/akademik/absensi",logKind:"update",entityType:"absensi_batch",entityId:"simpan-absensi",entityLabel:"Absensi pengajian",summary:`Menyimpan absensi pengajian (${a.length} baris)`,details:{saved_rows:a.length,libur_rows:b.length,libur_aktif:e}}),(0,g.revalidatePath)("/dashboard/akademik/absensi"),(0,g.revalidatePath)("/dashboard/akademik/absensi/rekap"),{success:!0,saved:a.length}}catch(a){return console.error("Batch save error:",a),{error:a?.message||"Gagal menyimpan batch"}}}async function o(){return(await (0,d.query)(`
    SELECT k.id, k.nama_kelas, k.marhalah_id
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function p(){return(await (0,d.query)(`
    SELECT DISTINCT asrama 
    FROM santri 
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL AND asrama != '' 
    ORDER BY asrama
  `)).map(a=>a.asrama)}async function q(){return(0,h.getCachedMarhalahList)()}async function r(a){let{start:b,end:c}=l(new Date(a)),e=b.toISOString().split("T")[0],f=c.toISOString().split("T")[0],g=await (0,d.query)(`
    WITH ProblemStudents AS (
      SELECT DISTINCT riwayat_pendidikan_id
      FROM absensi_harian
      WHERE tanggal >= ? AND tanggal <= ?
        AND (shubuh = 'A' OR ashar = 'A' OR maghrib = 'A')
    )
    SELECT 
      rp.id, 
      s.nama_lengkap, 
      s.asrama, 
      s.kamar, 
      s.sekolah, 
      s.kelas_sekolah,
      k.nama_kelas AS kelas_pesantren,
      ah.tanggal,
      ah.shubuh,
      ah.ashar,
      ah.maghrib
    FROM ProblemStudents ps
    JOIN riwayat_pendidikan rp ON rp.id = ps.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN absensi_harian ah ON ah.riwayat_pendidikan_id = ps.riwayat_pendidikan_id
      AND ah.tanggal >= ? AND ah.tanggal <= ?
    ORDER BY s.nama_lengkap
  `,[e,f,e,f]),h=new Map,i={};return g.forEach(a=>{h.has(a.id)||h.set(a.id,{id:a.id,nama_lengkap:a.nama_lengkap,asrama:a.asrama,kamar:a.kamar,sekolah:a.sekolah,kelas_sekolah:a.kelas_sekolah,kelas_pesantren:a.kelas_pesantren}),a.tanggal&&(i[a.id]||(i[a.id]={}),i[a.id][a.tanggal]={shubuh:a.shubuh,ashar:a.ashar,maghrib:a.maghrib})}),{santri:Array.from(h.values()),absensi:i}}(0,i.ensureServerEntryExports)([m,n,o,p,q,r]),(0,c.registerServerReference)(m,"60b6102c64166efb09e028f62d2b92176dc9d63989",null),(0,c.registerServerReference)(n,"60f929c0f80b8b601ea597f680167e3c7bb82a99dc",null),(0,c.registerServerReference)(o,"0041b1607ab4a87be93aaf31104360e4d0365c7220",null),(0,c.registerServerReference)(p,"00be8481159b4428aac0527ae7d8d611c39e129b37",null),(0,c.registerServerReference)(q,"0061b26d690f8c52c1b53a961658921ac67bf95c9a",null),(0,c.registerServerReference)(r,"40f30a990969615f5d9816766b2efce8893aa3ac7b",null),a.s([],42957),a.i(42957),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"0041b1607ab4a87be93aaf31104360e4d0365c7220",()=>o,"0061b26d690f8c52c1b53a961658921ac67bf95c9a",()=>q,"00be8481159b4428aac0527ae7d8d611c39e129b37",()=>p,"40f30a990969615f5d9816766b2efce8893aa3ac7b",()=>r,"60b6102c64166efb09e028f62d2b92176dc9d63989",()=>m,"60f929c0f80b8b601ea597f680167e3c7bb82a99dc",()=>n],44453)}];

//# sourceMappingURL=_59821479._.js.map