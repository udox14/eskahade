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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},82050,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(9343),i=a.i(13095);async function j(a,b={}){let c=[],e=[];if(a){let b,d,f,g,{start:h,end:i}=(d=(b=new Date(new Date(a))).getDay(),b.setDate(b.getDate()-((d<3?d+7:d)-3)),b.setHours(0,0,0,0),f=new Date(b),(g=new Date(b)).setDate(g.getDate()+6),{start:f,end:g});c.push("ah.tanggal >= ? AND ah.tanggal <= ?"),e.push(h.toISOString().split("T")[0],i.toISOString().split("T")[0])}else{let a=new Date;a.setMonth(a.getMonth()-3),c.push("ah.tanggal >= ?"),e.push(a.toISOString().slice(0,10))}b.kelasId&&(c.push("rp.kelas_id = ?"),e.push(b.kelasId)),b.asrama&&(c.push("s.asrama = ?"),e.push(b.asrama)),b.marhalahId&&(c.push("k.marhalah_id = ?"),e.push(b.marhalahId));let f=c.join(" AND "),g=await (0,d.query)(`
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    INNER JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
      AND rp.status_riwayat = 'aktif'
    INNER JOIN santri s ON s.id = rp.santri_id
      AND s.status_global = 'aktif'
    INNER JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${f}
      AND (
        (ah.shubuh  = 'A' AND (ah.verif_shubuh  IS NULL OR ah.verif_shubuh  = 'BELUM'))
        OR
        (ah.ashar   = 'A' AND (ah.verif_ashar   IS NULL OR ah.verif_ashar   = 'BELUM'))
        OR
        (ah.maghrib = 'A' AND (ah.verif_maghrib IS NULL OR ah.verif_maghrib = 'BELUM'))
      )
    ORDER BY ah.tanggal DESC, s.nama_lengkap ASC
    LIMIT 2000
  `,e),h=new Map;return g.forEach(a=>{["shubuh","ashar","maghrib"].forEach(b=>{let c="A"===a[b],d=null==a[`verif_${b}`]||"BELUM"===a[`verif_${b}`];c&&d&&(h.has(a.santri_id)||h.set(a.santri_id,{santri_id:a.santri_id,nama:a.nama_lengkap,nis:a.nis,info:`${a.asrama||"-"} / ${a.kamar||"-"}`,items:[]}),h.get(a.santri_id).items.push({absen_id:a.id,tanggal:a.tanggal,sesi:b,status_verif:a[`verif_${b}`]}))})}),Array.from(h.values())}let k=["shubuh","ashar","maghrib"];function l(a){if(!k.includes(a))throw Error(`Sesi tidak valid: ${a}`);return`verif_${a}`}async function m(a){let b=await (0,e.getSession)();if(!a||0===a.length)return{error:"Tidak ada data untuk disimpan"};let c=[];for(let e of a){let{santriId:a,items:f,vonis:g}=e;if("ALFA_MURNI"===g){let e=f.length,g=10*e,h=f.sort((a,b)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime()).map(a=>{let b=new Date(a.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short"});return`${b} (${a.sesi})`}).join(", ");for(let i of(c.push({id:(0,d.generateId)(),santri_id:a,tanggal:(0,d.now)(),jenis:"ALFA_PENGAJIAN",deskripsi:`Akumulasi Alfa Pengajian (${e} Sesi).
Detail: ${h}`,poin:g,penindak_id:b?.id??null}),f))await (0,d.execute)(`UPDATE absensi_harian SET ${l(i.sesi)} = 'OK' WHERE id = ?`,[i.absen_id])}else if("BELUM"===g)for(let a of f)await (0,d.execute)(`UPDATE absensi_harian SET ${l(a.sesi)} = 'BELUM' WHERE id = ?`,[a.absen_id]);else{let a="SAKIT"===g?"S":"IZIN"===g?"I":"H";for(let b of f)await (0,d.execute)(`UPDATE absensi_harian SET ${function(a){if(!k.includes(a))throw Error(`Sesi tidak valid: ${a}`);return a}(b.sesi)} = ?, ${l(b.sesi)} = NULL WHERE id = ?`,[a,b.absen_id])}}for(let a of c)await (0,d.execute)(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,[a.id,a.santri_id,a.tanggal,a.jenis,a.deskripsi,a.poin,a.penindak_id]);let h=a.filter(a=>"ALFA_MURNI"===a.vonis).length,i=a.filter(a=>"SAKIT"===a.vonis).length,j=a.filter(a=>"IZIN"===a.vonis).length,m=a.filter(a=>"KESALAHAN"===a.vonis).length,n=a.filter(a=>"BELUM"===a.vonis).length;return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_absensi_verifikasi",action:"approval",fiturHref:"/dashboard/akademik/absensi/verifikasi",logKind:"update",entityType:"verifikasi_absensi_batch",entityId:"verifikasi-massal",entityLabel:"Verifikasi absensi",summary:`Memverifikasi absensi massal untuk ${a.length} santri`,details:{total_santri:a.length,total_pelanggaran:c.length,alfa_murni:h,sakit:i,izin:j,kesalahan:m,belum:n}}),(0,g.revalidatePath)("/dashboard/akademik/absensi/verifikasi"),(0,g.revalidatePath)("/dashboard/keamanan"),{success:!0,count:a.length}}async function n(){return(await (0,d.query)(`
    SELECT k.id, k.nama_kelas, k.marhalah_id
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function o(){return(await (0,d.query)(`
    SELECT DISTINCT asrama 
    FROM santri 
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL AND asrama != '' 
    ORDER BY asrama
  `)).map(a=>a.asrama)}async function p(){return(0,h.getCachedMarhalahList)()}(0,i.ensureServerEntryExports)([j,m,n,o,p]),(0,c.registerServerReference)(j,"60e9624b16dcd79451956bb0817eb725ffa8db8a27",null),(0,c.registerServerReference)(m,"40457af5b51d7437387bc3ca3a8169983e93cdc7be",null),(0,c.registerServerReference)(n,"00652153a4eb1c3f04b401afec4579532448a0ae7e",null),(0,c.registerServerReference)(o,"0009917a3c84fbba820d66564c9cffb94123f34a2e",null),(0,c.registerServerReference)(p,"0007a14f6dca6950e70f28f6f59cf5adb5fd2be3ed",null),a.s([],83654),a.i(83654),a.s(["0007a14f6dca6950e70f28f6f59cf5adb5fd2be3ed",()=>p,"0009917a3c84fbba820d66564c9cffb94123f34a2e",()=>o,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00652153a4eb1c3f04b401afec4579532448a0ae7e",()=>n,"40457af5b51d7437387bc3ca3a8169983e93cdc7be",()=>m,"60e9624b16dcd79451956bb0817eb725ffa8db8a27",()=>j],82050)}];

//# sourceMappingURL=_bf43bf34._.js.map