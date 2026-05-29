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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},52201,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(4552),f=a.i(18558);async function g(a){return(0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            s.nama_ayah, s.alamat,
            k.nama_kelas,
            COUNT(p.id) AS jumlah_pelanggaran
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     LEFT JOIN pelanggaran p ON p.santri_id = s.id
     WHERE s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis = ?)
     GROUP BY s.id
     LIMIT 8`,[`%${a}%`,a])}async function h(a){return(0,d.query)(`SELECT p.id, p.tanggal, p.deskripsi, p.jenis, p.poin
     FROM pelanggaran p
     WHERE p.santri_id = ?
     ORDER BY p.tanggal DESC`,[a])}async function i(a){let b=await (0,d.queryOne)(`SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,[a]);return b?({SP1:"SP2",SP2:"SP3",SP3:"SK",SK:"SK"})[b.level]??"SP1":"SP1"}async function j(a,b,c){let g=await (0,e.assertFeature)("/dashboard/surat-santri");if("error"in g)return g;if(0===b.length)return{error:"Pilih minimal 1 pelanggaran"};let h=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,[h,a,JSON.stringify(b),c,g.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0,id:h}}async function k(a,b,c,g){let h=await (0,e.assertFeature)("/dashboard/surat-santri");if("error"in h)return h;let i=(0,d.generateId)();return await (0,d.execute)(`INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[i,a,b,c,g||null,h.id,(0,d.now)()]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0,id:i}}async function l(a){let{search:b,asrama:c,jenis:e,page:f=1}=a,g=[],h=[];b&&(g.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),h.push(`%${b}%`,`%${b}%`)),c&&(g.push("s.asrama = ?"),h.push(c));let i=g.length?`AND ${g.join(" AND ")}`:"",j=e&&"pernyataan"!==e?"AND 0=1":"",k=!e||["SP1","SP2","SP3","SK"].includes(e)?e&&"pernyataan"!==e?`AND sp.level = '${e}'`:"":"AND 0=1",l=`
    SELECT
      'pernyataan' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      sp.pelanggaran_ids AS detail,
      NULL AS level,
      NULL AS catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_pernyataan sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${i} ${j}

    UNION ALL

    SELECT
      'perjanjian' AS tipe,
      sp.id, sp.tanggal, sp.created_at,
      s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      NULL AS detail,
      sp.level,
      sp.catatan,
      u.full_name AS dibuat_oleh_nama
    FROM surat_perjanjian sp
    JOIN santri s ON s.id = sp.santri_id
    LEFT JOIN users u ON u.id = sp.dibuat_oleh
    WHERE 1=1 ${i} ${k}
  `,m=await (0,d.queryOne)(`SELECT COUNT(*) AS total FROM (${l}) t`,[...h,...h]),n=m?.total??0;return{rows:await (0,d.query)(`SELECT * FROM (${l}) t ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...h,...h,30,(f-1)*30]),total:n,page:f,totalPages:Math.ceil(n/30)}}async function m(a,b){if("pernyataan"===b){let b=await (0,d.queryOne)(`SELECT sp.id, sp.tanggal, sp.pelanggaran_ids,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_pernyataan sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,[a]);if(!b)return null;let c=JSON.parse(b.pelanggaran_ids||"[]");return{tipe:"pernyataan",surat:b,pelanggaran:c.length?await (0,d.query)(`SELECT id, tanggal, deskripsi, jenis, poin FROM pelanggaran
           WHERE id IN (${c.map(()=>"?").join(",")}) ORDER BY tanggal ASC`,c):[]}}{let b=await (0,d.queryOne)(`SELECT sp.id, sp.tanggal, sp.level, sp.catatan,
              s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM surat_perjanjian sp
       JOIN santri s ON s.id = sp.santri_id
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE sp.id = ?`,[a]);return b?{tipe:"perjanjian",surat:b,pelanggaran:[]}:null}}async function n(a,b){let c=await (0,e.assertFeature)("/dashboard/surat-santri");return"error"in c?c:(await (0,d.execute)(`DELETE FROM ${"pernyataan"===b?"surat_pernyataan":"surat_perjanjian"} WHERE id = ?`,[a]),(0,f.revalidatePath)("/dashboard/surat-santri"),{success:!0})}async function o(){return(await (0,d.query)("SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama")).map(a=>a.asrama)}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k,l,m,n,o]),(0,c.registerServerReference)(g,"402cdbdc18c936ce5d08ce5bdb6d5c411f736476a0",null),(0,c.registerServerReference)(h,"404ae47398bc259fd26f42e1d34d03750d8111ef5f",null),(0,c.registerServerReference)(i,"40fd22833b5738f82082d7e890fc3f21a95a429a5b",null),(0,c.registerServerReference)(j,"70373b906e48aa4bd4d3560df4d904042edacd6b78",null),(0,c.registerServerReference)(k,"788415ee0890dded84fdefdbaf479cbdd14c86f694",null),(0,c.registerServerReference)(l,"4022a5b4f0829729b28adaa6e9d774556fd9f03da2",null),(0,c.registerServerReference)(m,"609b978327f4ff57eeb7ee93e5c8151d8dd1808bb9",null),(0,c.registerServerReference)(n,"608c3b3a054394e9c8cbf55a48068a327501b18ffa",null),(0,c.registerServerReference)(o,"00d5e389dfceb9571f9931b9fd956f2b88cf41e090",null),a.s([],72377),a.i(72377),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00d5e389dfceb9571f9931b9fd956f2b88cf41e090",()=>o,"4022a5b4f0829729b28adaa6e9d774556fd9f03da2",()=>l,"402cdbdc18c936ce5d08ce5bdb6d5c411f736476a0",()=>g,"404ae47398bc259fd26f42e1d34d03750d8111ef5f",()=>h,"40fd22833b5738f82082d7e890fc3f21a95a429a5b",()=>i,"608c3b3a054394e9c8cbf55a48068a327501b18ffa",()=>n,"609b978327f4ff57eeb7ee93e5c8151d8dd1808bb9",()=>m,"70373b906e48aa4bd4d3560df4d904042edacd6b78",()=>j,"788415ee0890dded84fdefdbaf479cbdd14c86f694",()=>k],52201)}];

//# sourceMappingURL=_8d16c7ca._.js.map