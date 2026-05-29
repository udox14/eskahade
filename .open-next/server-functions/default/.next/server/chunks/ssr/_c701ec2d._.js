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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},93297,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(9343),f=a.i(53058),g=a.i(6846),h=a.i(18558);async function i(){return(0,e.getCachedMarhalahList)()}async function j(a){return a?(await (0,d.query)(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    WHERE k.marhalah_id = ?
  `,[a])).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"})):[]}async function k(a,b){let c=[];if(b?c=[b]:a&&(c=(await (0,d.query)(`
      SELECT k.id FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.marhalah_id = ?
    `,[a])).map(a=>a.id)),!c.length)return[];let e=c.map(()=>"?").join(",");return(await (0,d.query)(`
    SELECT rp.id, rp.grade_lanjutan,
           s.id AS santri_id, s.nama_lengkap, s.nis,
           k.nama_kelas,
           r.rata_rata, r.predikat
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id
    WHERE rp.kelas_id IN (${e}) AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `,c)).map(a=>({riwayat_id:a.id,santri_id:a.santri_id,nis:a.nis,nama:a.nama_lengkap,kelas_sekarang:a.nama_kelas,grade_lanjutan:a.grade_lanjutan||"Belum Di-Grading",rata_rata:a.rata_rata||0,predikat:a.predikat||"-"}))}async function l(a){let b=await (0,f.getSession)();if(!a||!a.length)return{error:"Data kosong."};let c=await (0,d.query)(`
    SELECT k.id, k.nama_kelas FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `,[]),e=new Map;c.forEach(a=>e.set(a.nama_kelas.trim().toLowerCase(),a.id));let i=await (0,d.query)(`
    SELECT rp.id, s.nis
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.status_riwayat = 'aktif'
  `,[]),j=new Map;i.forEach(a=>{a.nis&&j.set(String(a.nis).trim(),a.id)});let k=[];for(let b=0;b<a.length;b++){let c=a[b],d=String(c.NIS||c.nis||"").trim(),f=String(c["TARGET KELAS"]||c["target kelas"]||"").trim();f&&(j.get(d)?e.get(f.toLowerCase())||k.push(`Baris ${b+2}: Kelas '${f}' tidak ditemukan.`):k.push(`Baris ${b+2}: Santri NIS ${d} tidak ditemukan.`))}if(k.length>0)return{error:`Ditemukan masalah:
${k.slice(0,5).join("\n")}`};let l=new Map;i.forEach(a=>{a.nis&&l.set(String(a.nis).trim(),{riwayat_id:a.id,santri_id:a.santri_id})});let m=[],n=[];for(let b of a){let a=String(b["TARGET KELAS"]||b["target kelas"]||"").trim();if(!a)continue;let c=String(b.NIS||b.nis||"").trim(),d=l.get(c),f=e.get(a.toLowerCase());d&&f&&(m.push(d.riwayat_id),n.push({santri_id:d.santri_id,kelas_id:f}))}if(!n.length)return{error:"Tidak ada data valid untuk diproses."};for(let a=0;a<m.length;a+=200){let b=m.slice(a,a+200),c=b.map(()=>"?").join(",");await (0,d.execute)(`UPDATE riwayat_pendidikan SET status_riwayat = 'naik' WHERE id IN (${c})`,b)}for(let a of n)await (0,d.execute)(`
      INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at)
      VALUES (?, ?, ?, 'aktif', ?)
    `,[(0,d.generateId)(),a.santri_id,a.kelas_id,(0,d.now)()]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(b),module:"akademik_kenaikan",action:"update",fiturHref:"/dashboard/akademik/kenaikan",logKind:"update",entityType:"kenaikan_kelas_batch",entityId:"import-kenaikan",entityLabel:"Import kenaikan kelas",summary:`Import kenaikan kelas untuk ${n.length} santri`,details:{total_rows:a.length,updated_riwayat:m.length,inserted_riwayat:n.length}}),(0,h.revalidatePath)("/dashboard/akademik/kenaikan"),{success:!0,count:n.length}}(0,a.i(13095).ensureServerEntryExports)([i,j,k,l]),(0,c.registerServerReference)(i,"001ba5aaf7999b34fa9886b7c5d71fc3674ba80735",null),(0,c.registerServerReference)(j,"405401b94d6994c79290c9e5051c42a6f592494527",null),(0,c.registerServerReference)(k,"6010bc74957a3073c6722859aa859f0472b8a3b3fe",null),(0,c.registerServerReference)(l,"40e06f1c04b7e7dc61090a956949b4ae0cb7bcbb20",null),a.s([],37795),a.i(37795),a.s(["001ba5aaf7999b34fa9886b7c5d71fc3674ba80735",()=>i,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"405401b94d6994c79290c9e5051c42a6f592494527",()=>j,"40e06f1c04b7e7dc61090a956949b4ae0cb7bcbb20",()=>l,"6010bc74957a3073c6722859aa859f0472b8a3b3fe",()=>k],93297)}];

//# sourceMappingURL=_c701ec2d._.js.map