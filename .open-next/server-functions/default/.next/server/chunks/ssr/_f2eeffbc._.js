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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},40621,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(4552),g=a.i(6846),h=a.i(18558),i=a.i(13095);let j=new Set(["RINGAN","SEDANG","BERAT"]);function k(a){return String(a??"").trim()}function l(a,b){return`${a}::${b.trim().toLowerCase().replace(/\s+/g," ")}`}async function m(){return(0,d.query)(`SELECT id, kategori, nama_pelanggaran, poin, deskripsi, urutan
     FROM master_pelanggaran
     ORDER BY CASE kategori WHEN 'RINGAN' THEN 1 WHEN 'SEDANG' THEN 2 WHEN 'BERAT' THEN 3 ELSE 4 END,
              urutan, nama_pelanggaran`)}async function n(a){let b=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in b)return b;let c=await (0,e.getSession)();return await (0,d.execute)("INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi) VALUES (?, ?, ?, ?)",[a.kategori,a.nama,a.poin,a.deskripsi||null]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan",action:"create",fiturHref:"/dashboard/keamanan",logKind:"create",entityType:"master_pelanggaran",entityLabel:a.nama,summary:`Menambahkan master pelanggaran ${a.nama}`,details:{kategori:a.kategori,poin:a.poin,deskripsi:a.deskripsi||null}}),(0,h.revalidateTag)("master-pelanggaran","everything"),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0}}async function o(a,b){let c=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in c)return c;let i=await (0,e.getSession)(),j=await (0,d.queryOne)("SELECT id, kategori, nama_pelanggaran, poin, deskripsi FROM master_pelanggaran WHERE id = ?",[a]);return j?(await (0,d.execute)("UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, poin=?, deskripsi=? WHERE id=?",[b.kategori,b.nama,b.poin,b.deskripsi||null,a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(i),module:"keamanan",action:"update",fiturHref:"/dashboard/keamanan",logKind:"update",entityType:"master_pelanggaran",entityId:String(a),entityLabel:String(j.nama_pelanggaran||b.nama),summary:`Memperbarui master pelanggaran ${String(j.nama_pelanggaran||b.nama)}`,details:{changed_fields:(0,g.diffWhitelistedFields)(j,{kategori:b.kategori,nama_pelanggaran:b.nama,poin:b.poin,deskripsi:b.deskripsi||null},["kategori","nama_pelanggaran","poin","deskripsi"])}}),(0,h.revalidateTag)("master-pelanggaran","everything"),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0}):{error:"Master pelanggaran tidak ditemukan."}}async function p(a){let b=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in b)return b;let c=await (0,e.getSession)(),i=await (0,d.queryOne)("SELECT id, kategori, nama_pelanggaran, poin, deskripsi FROM master_pelanggaran WHERE id = ?",[a]);if(!i)return{error:"Master pelanggaran tidak ditemukan."};let j=await (0,d.queryOne)("SELECT COUNT(*) AS n FROM pelanggaran WHERE master_id=?",[a]);return j&&j.n>0?{error:"Tidak bisa dihapus — sudah dipakai di data pelanggaran"}:(await (0,d.execute)("DELETE FROM master_pelanggaran WHERE id=?",[a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan",action:"delete",fiturHref:"/dashboard/keamanan",logKind:"delete",entityType:"master_pelanggaran",entityId:String(i.id),entityLabel:i.nama_pelanggaran||String(i.id),summary:`Menghapus master pelanggaran ${i.nama_pelanggaran||i.id}`,details:{kategori:i.kategori,poin:i.poin,deskripsi:i.deskripsi}}),(0,h.revalidateTag)("master-pelanggaran","everything"),{success:!0})}async function q(a){let b=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in b)return b;let c=await (0,e.getSession)();if(!Array.isArray(a)||0===a.length)return{error:"Data import kosong."};let i=a.map((a,b)=>{let c=k(a.kategori).toUpperCase(),d=k(a.nama_pelanggaran||a.nama),e=Number(a.poin),f=k(a.deskripsi),g=k(a.urutan),h=g?Number(g):0;return j.has(c)?d?!Number.isFinite(e)||e<0?{error:`Baris ${b+2}: poin harus berupa angka minimal 0.`}:Number.isFinite(h)?{kategori:c,nama:d,poin:Math.round(e),deskripsi:f||null,urutan:Math.round(h),key:l(c,d)}:{error:`Baris ${b+2}: urutan harus berupa angka.`}:{error:`Baris ${b+2}: nama pelanggaran wajib diisi.`}:{error:`Baris ${b+2}: kategori harus RINGAN, SEDANG, atau BERAT.`}}),m=i.find(a=>"error"in a);if(m)return{error:m.error};let n=new Map;for(let a of i)"error"in a||n.set(a.key,a);let o=Array.from(n.values());if(0===o.length)return{error:"Tidak ada baris valid untuk diimport."};try{let b=await (0,d.query)("SELECT id, kategori, nama_pelanggaran FROM master_pelanggaran"),e=new Map(b.map(a=>[l(a.kategori,a.nama_pelanggaran),a.id])),f=o.map(a=>{let b=e.get(a.key);return b?{mode:"update",sql:"UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, poin=?, deskripsi=?, urutan=? WHERE id=?",params:[a.kategori,a.nama,a.poin,a.deskripsi,a.urutan,b]}:{mode:"insert",sql:"INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi, urutan) VALUES (?, ?, ?, ?, ?)",params:[a.kategori,a.nama,a.poin,a.deskripsi,a.urutan]}});for(let a=0;a<f.length;a+=50)await (0,d.batch)(f.slice(a,a+50).map(({sql:a,params:b})=>({sql:a,params:b})));let i=f.filter(a=>"insert"===a.mode).length,j=f.filter(a=>"update"===a.mode).length,k=a.length-o.length;return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan",action:"import",fiturHref:"/dashboard/keamanan",logKind:"create",entityType:"master_pelanggaran",summary:`Import kamus pelanggaran ${o.length} baris`,details:{inserted:i,updated:j,skipped:k}}),(0,h.revalidateTag)("master-pelanggaran","everything"),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0,inserted:i,updated:j,skipped:k}}catch(a){return{error:`Import gagal: ${a?.message||"kesalahan tidak diketahui"}`}}}async function r(a){return(0,d.query)(`SELECT id, nama_lengkap, nis, asrama, kamar, nama_ayah, alamat, foto_url
     FROM santri
     WHERE status_global = 'aktif'
       AND (nama_lengkap LIKE ? OR nis = ?)
     LIMIT 8`,[`%${a}%`,a])}async function s(a){let b=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in b)return b;let c=await (0,d.queryOne)("SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran WHERE id=?",[a.masterId]);if(!c)return{error:"Jenis pelanggaran tidak ditemukan"};let i=a.deskripsiTambahan?`${c.nama_pelanggaran}. ${a.deskripsiTambahan}`:c.nama_pelanggaran;await (0,d.execute)(`INSERT INTO pelanggaran (id, santri_id, master_id, jenis, deskripsi, tanggal, poin, foto_url, penindak_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,d.generateId)(),a.santriId,a.masterId,c.kategori,i,a.tanggal,c.poin,a.fotoUrl||null,b.id]);let j=await (0,e.getSession)(),k=await (0,d.queryOne)("SELECT nama_lengkap, nis FROM santri WHERE id = ?",[a.santriId]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(j),module:"keamanan",action:"create",fiturHref:"/dashboard/keamanan",logKind:"create",entityType:"pelanggaran",entityLabel:k?.nama_lengkap||k?.nis||a.santriId,summary:`Mencatat pelanggaran untuk ${k?.nama_lengkap||k?.nis||a.santriId}`,details:{jenis:c.kategori,nama_pelanggaran:c.nama_pelanggaran,poin:c.poin,tanggal:a.tanggal}}),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0}}async function t(a){let b=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in b)return b;let c=await (0,e.getSession)(),i=await (0,d.queryOne)(`SELECT p.id, p.deskripsi, p.jenis, p.poin, s.nama_lengkap
     FROM pelanggaran p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,[a]);if(!i)return{error:"Data pelanggaran tidak ditemukan."};for(let b of(await (0,d.query)(`SELECT id, pelanggaran_ids FROM surat_pernyataan
     WHERE pelanggaran_ids LIKE ?`,[`%"${a}"%`]))){let c=JSON.parse(b.pelanggaran_ids||"[]").filter(b=>b!==a);0===c.length?await (0,d.execute)("DELETE FROM surat_pernyataan WHERE id=?",[b.id]):await (0,d.execute)("UPDATE surat_pernyataan SET pelanggaran_ids=? WHERE id=?",[JSON.stringify(c),b.id])}return await (0,d.execute)("DELETE FROM pelanggaran WHERE id=?",[a]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"keamanan",action:"delete",fiturHref:"/dashboard/keamanan",logKind:"delete",entityType:"pelanggaran",entityId:a,entityLabel:i.nama_lengkap||a,summary:`Menghapus pelanggaran milik ${i.nama_lengkap||a}`,details:{deskripsi:i.deskripsi,jenis:i.jenis,poin:i.poin}}),(0,h.revalidatePath)("/dashboard/keamanan"),(0,h.revalidatePath)("/dashboard/surat-santri"),{success:!0}}async function u(a){let{search:b,asrama:c,page:e=1}=a,f=["s.status_global IN ('aktif','keluar')"],g=[];b&&(f.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),g.push(`%${b}%`,`%${b}%`)),c&&(f.push("s.asrama = ?"),g.push(c));let h=f.join(" AND "),i=await (0,d.queryOne)(`SELECT COUNT(DISTINCT p.santri_id) AS total
     FROM pelanggaran p JOIN santri s ON s.id = p.santri_id
     WHERE ${h}`,g),j=i?.total??0;return{rows:await (0,d.query)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            COUNT(p.id)    AS jumlah_pelanggaran,
            SUM(p.poin)    AS total_poin,
            MAX(p.tanggal) AS terakhir,
            -- Level SP terakhir (ringan: subquery kecil di tabel kecil)
            (SELECT sp.level FROM surat_perjanjian sp
             WHERE sp.santri_id = s.id
             ORDER BY sp.created_at DESC LIMIT 1) AS sp_terakhir
     FROM pelanggaran p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${h}
     GROUP BY p.santri_id
     ORDER BY total_poin DESC, terakhir DESC
     LIMIT ? OFFSET ?`,[...g,30,(e-1)*30]),total:j,page:e,totalPages:Math.ceil(j/30)}}async function v(a){let[b,c,e,f]=await Promise.all([(0,d.queryOne)(`SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
              s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,[a]),(0,d.query)(`SELECT p.id, p.tanggal, p.jenis, p.deskripsi, p.poin, p.foto_url,
              u.full_name AS penindak_nama,
              mp.nama_pelanggaran
       FROM pelanggaran p
       LEFT JOIN users u ON u.id = p.penindak_id
       LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
       WHERE p.santri_id = ?
       ORDER BY p.tanggal DESC, p.created_at DESC`,[a]),(0,d.query)(`SELECT sp.id, sp.tanggal, sp.pelanggaran_ids, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_pernyataan sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,[a]),(0,d.query)(`SELECT sp.id, sp.level, sp.tanggal, sp.catatan, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_perjanjian sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,[a])]);return{profil:b,pelanggaran:c,suratPernyataan:e,suratPerjanjian:f}}async function w(a,b,c){let i=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in i)return i;let j=(0,d.generateId)();await (0,d.execute)(`INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,[j,a,JSON.stringify(b),c,i.id,(0,d.now)()]);let k=await (0,e.getSession)(),l=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[a]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(k),module:"keamanan",action:"create",fiturHref:"/dashboard/keamanan",logKind:"create",entityType:"surat_pernyataan",entityId:j,entityLabel:l?.nama_lengkap||a,summary:`Membuat surat pernyataan untuk ${l?.nama_lengkap||a}`,details:{tanggal:c,jumlah_pelanggaran:b.length}}),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0,id:j}}async function x(a,b,c,i){let j=await (0,f.assertFeature)("/dashboard/keamanan");if("error"in j)return j;let k=(0,d.generateId)();await (0,d.execute)(`INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,[k,a,b,c,i||null,j.id,(0,d.now)()]);let l=await (0,e.getSession)(),m=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[a]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(l),module:"keamanan",action:"create",fiturHref:"/dashboard/keamanan",logKind:"create",entityType:"surat_perjanjian",entityId:k,entityLabel:m?.nama_lengkap||a,summary:`Membuat surat perjanjian ${b} untuk ${m?.nama_lengkap||a}`,details:{level:b,tanggal:c,catatan:i||null}}),(0,h.revalidatePath)("/dashboard/keamanan"),{success:!0,id:k}}async function y(a,b){let[c,e]=await Promise.all([(0,d.queryOne)(`SELECT s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,[a]),b.length>0?(0,d.query)(`SELECT id, tanggal, deskripsi, jenis, poin
           FROM pelanggaran
           WHERE id IN (${b.map(()=>"?").join(",")})
           ORDER BY tanggal ASC`,b):Promise.resolve([])]);return{profil:c,pelanggaran:e}}async function z(a){let b=await (0,d.queryOne)(`SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,[a]);return b?({SP1:"SP2",SP2:"SP3",SP3:"SK",SK:"SK"})[b.level]??"SP1":"SP1"}(0,i.ensureServerEntryExports)([m,n,o,p,q,r,s,t,u,v,w,x,y,z]),(0,c.registerServerReference)(m,"000d8c169e2790dc299a1a9012835e477fa5448cf4",null),(0,c.registerServerReference)(n,"4009dc817bb67a87594aaf20278f427570bbedbb51",null),(0,c.registerServerReference)(o,"60467f62358c52aa45889d4f9536eccf217b8dddfe",null),(0,c.registerServerReference)(p,"402d755695c76ee3ef1136347fe155c02c368ed5c6",null),(0,c.registerServerReference)(q,"400a87179796d94c06a9be468f287b88367771455c",null),(0,c.registerServerReference)(r,"4034db26f313ef2c5caff034a5864bcae772a54c3c",null),(0,c.registerServerReference)(s,"40a2d535850da83b9784d954f8ac0d008af8074a48",null),(0,c.registerServerReference)(t,"40cea23039961f27c012c2e51325c1660d006078bb",null),(0,c.registerServerReference)(u,"40f89c11da923104186049b86c50803869b2f69537",null),(0,c.registerServerReference)(v,"40e15b5b9036c5be346849c97da175641c4d4b3bdd",null),(0,c.registerServerReference)(w,"7069f53f54da5f34e0b12d4ba27493d1d664c65e10",null),(0,c.registerServerReference)(x,"78d5ce2dffd4c6b68ebc1785dd855dd060a5182f99",null),(0,c.registerServerReference)(y,"6021e555c856e47e54ec5eb4121e739214dce4fbdb",null),(0,c.registerServerReference)(z,"4048edd587b8b9397d8816b7e4ffee3e4eb3835547",null),a.s([],2916),a.i(2916),a.s(["000d8c169e2790dc299a1a9012835e477fa5448cf4",()=>m,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"4009dc817bb67a87594aaf20278f427570bbedbb51",()=>n,"400a87179796d94c06a9be468f287b88367771455c",()=>q,"402d755695c76ee3ef1136347fe155c02c368ed5c6",()=>p,"4034db26f313ef2c5caff034a5864bcae772a54c3c",()=>r,"40a2d535850da83b9784d954f8ac0d008af8074a48",()=>s,"40cea23039961f27c012c2e51325c1660d006078bb",()=>t,"40e15b5b9036c5be346849c97da175641c4d4b3bdd",()=>v,"40f89c11da923104186049b86c50803869b2f69537",()=>u,"60467f62358c52aa45889d4f9536eccf217b8dddfe",()=>o],40621)}];

//# sourceMappingURL=_f2eeffbc._.js.map