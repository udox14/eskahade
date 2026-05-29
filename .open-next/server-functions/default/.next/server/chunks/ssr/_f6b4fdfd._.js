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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},70377,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558);async function h(a){let{search:b="",page:c=1,filterStatus:e="SEMUA",asrama:f}=a,g=["s.status_global = 'aktif'","NOT EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.santri_id = s.id)"],h=[];b&&(g.push("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)"),h.push(`%${b}%`,`%${b}%`)),"SUDAH"===e&&g.push("h.id IS NOT NULL"),"BELUM"===e&&g.push("h.id IS NULL"),f&&(g.push("s.asrama = ?"),h.push(f));let i=g.join(" AND "),j=await (0,d.queryOne)(`SELECT COUNT(*) AS total
     FROM santri s
     LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
     WHERE ${i}`,h),k=j?.total??0;return{rows:(await (0,d.query)(`SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar,
            h.id AS hasil_id, h.rekomendasi_marhalah, h.catatan_grade,
            h.hari_tes, h.sesi_tes, h.tulis_arab, h.baca_kelancaran,
            h.baca_tajwid, h.hafalan_juz, h.nahwu_pengalaman
     FROM santri s
     LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
     WHERE ${i}
     ORDER BY h.id IS NULL DESC, s.nama_lengkap
     LIMIT ? OFFSET ?`,[...h,30,(c-1)*30])).map(a=>({id:a.id,nis:a.nis,nama:a.nama_lengkap,jk:a.jenis_kelamin,asrama:a.asrama,kamar:a.kamar,status_tes:a.hasil_id?"SUDAH":"BELUM",hasil:a.hasil_id?{id:a.hasil_id,rekomendasi_marhalah:a.rekomendasi_marhalah,catatan_grade:a.catatan_grade,hari_tes:a.hari_tes,sesi_tes:a.sesi_tes,tulis_arab:a.tulis_arab,baca_kelancaran:a.baca_kelancaran,baca_tajwid:a.baca_tajwid,hafalan_juz:a.hafalan_juz,nahwu_pengalaman:a.nahwu_pengalaman}:null})),total:k,page:c,totalPages:Math.ceil(k/30),pageSize:30}}async function i(){return(await (0,d.query)(`SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL
     ORDER BY asrama`)).map(a=>a.asrama)}async function j(a){let b=a.get("santri_id"),c=a.get("hari_tes"),h=a.get("sesi_tes"),i=a.get("tulis_arab"),j=a.get("baca_kelancaran"),k=a.get("baca_tajwid"),l=Number(a.get("hafalan_juz")||0),m="on"===a.get("nahwu_pengalaman"),n="Ibtidaiyyah 1",o="Grade C";"TIDAK_BISA"===j?(n="Tamhidiyyah 1",o="-"):"TIDAK_LANCAR"===j?"BURUK"===k?(n="Tamhidiyyah 2",o="Grade B"):"KURANG"===k?(n="Tamhidiyyah 2",o="Grade A"):"BAIK"===k&&(n="Ibtidaiyyah 1",o="BAIK"===i?"Grade B":"Grade C"):"LANCAR"===j&&(n="Ibtidaiyyah 1","BURUK"===k?o="Grade C":"KURANG"===k?o="BAIK"===i?"Grade B":"Grade C":"BAIK"===k&&(o="BAIK"===i?"Grade A":"Grade B")),m&&(o+=" (REKOMENDASI TES NAHWU LANJUTAN)");let p=await (0,e.getSession)(),q=p?.id||null,r=new Date().toISOString(),s=await (0,d.queryOne)("SELECT id FROM hasil_tes_klasifikasi WHERE santri_id = ?",[b]);s?await (0,d.query)(`UPDATE hasil_tes_klasifikasi SET
        hari_tes = ?, sesi_tes = ?, tulis_arab = ?, baca_kelancaran = ?, baca_tajwid = ?,
        hafalan_juz = ?, nahwu_pengalaman = ?, rekomendasi_marhalah = ?, catatan_grade = ?,
        tester_id = ?, updated_at = ?
       WHERE santri_id = ?`,[c,h,i,j,k,l,+!!m,n,o,q,r,b]):await (0,d.query)(`INSERT INTO hasil_tes_klasifikasi
        (id, santri_id, hari_tes, sesi_tes, tulis_arab, baca_kelancaran, baca_tajwid,
         hafalan_juz, nahwu_pengalaman, rekomendasi_marhalah, catatan_grade, tester_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[crypto.randomUUID(),b,c,h,i,j,k,l,+!!m,n,o,q,r,r]);let t=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[b]);return await (0,f.logActivity)({actor:(0,f.actorFromSession)(p),module:"santri_tes_klasifikasi",action:s?"update":"create",fiturHref:"/dashboard/santri/tes-klasifikasi",logKind:s?"update":"create",entityType:"hasil_tes_klasifikasi",entityId:b,entityLabel:t?.nama_lengkap||b,summary:`${s?"Memperbarui":"Mencatat"} tes klasifikasi ${t?.nama_lengkap||b}`,details:{rekomendasi_marhalah:n,catatan_grade:o,hari_tes:c,sesi_tes:h}}),(0,g.revalidatePath)("/dashboard/santri/tes-klasifikasi"),{success:!0}}(0,a.i(13095).ensureServerEntryExports)([h,i,j]),(0,c.registerServerReference)(h,"40ca02d85245bfe4a8725f0f60dd6211b50d2c2fc0",null),(0,c.registerServerReference)(i,"000d9c10afa7e4644a0629b1a6a3e630d0e1a887db",null),(0,c.registerServerReference)(j,"4022a6ca310619cb8870684557e97803579c823548",null),a.s([],49758),a.i(49758),a.s(["000d9c10afa7e4644a0629b1a6a3e630d0e1a887db",()=>i,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"4022a6ca310619cb8870684557e97803579c823548",()=>j,"40ca02d85245bfe4a8725f0f60dd6211b50d2c2fc0",()=>h],70377)}];

//# sourceMappingURL=_f6b4fdfd._.js.map