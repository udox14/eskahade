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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},66270,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(9343);async function f(){return(0,d.query)("SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC")}async function g(a,b){let c=await (0,d.query)(`
    SELECT rp.id, rp.grade_lanjutan,
           s.nama_lengkap, s.nis, s.nama_ayah,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.jumlah_nilai,
           r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,[b,a]);if(!c.length)return[];let e=c.length,f=c.map(a=>a.id),g=f.map(()=>"?").join(","),i=await (0,d.query)(`
    SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    WHERE na.riwayat_pendidikan_id IN (${g}) AND na.semester = ?
    ORDER BY mp.nama ASC
  `,[...f,b]),j=await (0,d.query)(`
    SELECT
      riwayat_pendidikan_id,
      SUM(CASE WHEN shubuh  = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'S' THEN 1 ELSE 0 END) AS total_sakit,
      SUM(CASE WHEN shubuh  = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'I' THEN 1 ELSE 0 END) AS total_izin,
      SUM(CASE WHEN shubuh  = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'A' THEN 1 ELSE 0 END) AS total_alfa
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${g})
    GROUP BY riwayat_pendidikan_id
  `,f),k=new Map;j.forEach(a=>{k.set(a.riwayat_pendidikan_id,{sakit:a.total_sakit??0,izin:a.total_izin??0,alfa:a.total_alfa??0})});let l=await (0,d.query)(`
    SELECT riwayat_pendidikan_id, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian
    FROM nilai_akhlak
    WHERE riwayat_pendidikan_id IN (${g}) AND semester = ?
  `,[...f,b]),m=new Map;l.forEach(a=>{m.set(a.riwayat_pendidikan_id,[{label:"Akhlak/Budi Pekerti",predikat:h(a.kedisiplinan)},{label:"Ketekunan Ibadah",predikat:h(a.ibadah)},{label:"Kerapihan",predikat:h(a.kesopanan)},{label:"Kebersihan",predikat:h(a.kebersihan)}])});let n=c[0]?.marhalah_id,o=await (0,d.query)("SELECT tahun_ajaran_id FROM kelas WHERE id = ? LIMIT 1",[a]).then(a=>a[0]?.tahun_ajaran_id??null),p=[];n&&o&&(p=await (0,d.query)("SELECT mapel_id, nama_kitab FROM kitab WHERE marhalah_id = ? AND tahun_ajaran_id = ?",[n,o]));let q={},r={};return i.forEach(a=>{q[a.mapel_id]||(q[a.mapel_id]=0,r[a.mapel_id]=0),a.nilai>0&&(q[a.mapel_id]+=a.nilai,r[a.mapel_id]++)}),Object.keys(q).forEach(a=>{q[a]=r[a]>0?parseFloat((q[a]/r[a]).toFixed(2)):0}),c.map(a=>{let b=i.filter(b=>b.riwayat_pendidikan_id===a.id),c=k.get(a.id)??{sakit:0,izin:0,alfa:0};return{id:a.id,santri:{nama_lengkap:a.nama_lengkap,nis:a.nis,nama_ayah:a.nama_ayah},kelas:{id:a.kelas_id,nama_kelas:a.nama_kelas,grade_lanjutan:a.grade_lanjutan||null,marhalah:{id:a.marhalah_id,nama:a.marhalah_nama}},wali_kelas_nama:a.wali_kelas_nama||"..........................",ranking:{ranking_kelas:a.ranking_kelas??"-",total_santri:e,predikat:a.predikat??"-",rata_rata:a.rata_rata??0,jumlah_nilai:a.jumlah_nilai??0,catatan_wali_kelas:a.catatan_wali_kelas??""},nilai:b.map(a=>{let b=p.find(b=>b.mapel_id===a.mapel_id);return{mapel:a.mapel_nama||"Tanpa Nama",kitab:b?.nama_kitab||"-",angka:a.nilai,rata_kelas:q[a.mapel_id]??0}}),absen:{sakit:c.sakit,izin:c.izin,alfa:c.alfa},kepribadian:m.get(a.id)||[]}})}function h(a){return a>=90?"Sangat Baik":a>=75?"Baik":a>=60?"Cukup":"Kurang"}async function i(a){let b=a;if(!b){let a=await (0,e.getCachedTahunAjaranAktif)();b=a?.id}return(b?await (0,d.query)("SELECT id, nama_kelas FROM kelas WHERE tahun_ajaran_id = ?",[b]):await (0,d.query)("SELECT id, nama_kelas FROM kelas",[])).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function j(){try{let a=await (0,e.getCachedTahunAjaranAktif)();if(a?.nama)return a.nama}catch{}let a=new Date,b=a.getFullYear();return a.getMonth()+1>=7?`${b}/${b+1}`:`${b-1}/${b}`}(0,a.i(13095).ensureServerEntryExports)([f,g,i,j]),(0,c.registerServerReference)(f,"000a8d6d847cf82f2d38c88e7a5eb69e29b136ebe4",null),(0,c.registerServerReference)(g,"60030be883a00dac8bd2441b49b5c64f1a5e762936",null),(0,c.registerServerReference)(i,"4081f69c750d1da207afb5aed87e71b2b217fbf4b2",null),(0,c.registerServerReference)(j,"0070f03710fbb65692706c0755cd2c4e4281d3ff93",null),a.s([],24446),a.i(24446),a.s(["000a8d6d847cf82f2d38c88e7a5eb69e29b136ebe4",()=>f,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"4081f69c750d1da207afb5aed87e71b2b217fbf4b2",()=>i,"60030be883a00dac8bd2441b49b5c64f1a5e762936",()=>g],66270)}];

//# sourceMappingURL=_23958535._.js.map