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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},9343,a=>{"use strict";var b=a.i(18558),c=a.i(12259);let d=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama, urutan FROM marhalah ORDER BY urutan"),["marhalah-list"],{tags:["marhalah"],revalidate:86400}),e=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama"),["mapel-list"],{tags:["mapel"],revalidate:86400}),f=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama FROM mapel ORDER BY nama"),["mapel-all"],{tags:["mapel"],revalidate:86400}),g=(0,b.unstable_cache)(async()=>(0,c.queryOne)("SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1"),["tahun-ajaran-aktif"],{tags:["tahun-ajaran"],revalidate:3600}),h=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM tahun_ajaran ORDER BY id DESC"),["tahun-ajaran-list"],{tags:["tahun-ajaran"],revalidate:3600}),i=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC"),["biaya-settings"],{tags:["biaya-settings"],revalidate:86400}),j=(0,b.unstable_cache)(async()=>(0,c.query)("SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap"),["data-guru"],{tags:["data-guru"],revalidate:3600});a.s(["getCachedBiayaSettings",0,i,"getCachedDataGuru",0,j,"getCachedMapelAll",0,f,"getCachedMapelList",0,e,"getCachedMarhalahList",0,d,"getCachedTahunAjaranAktif",0,g,"getCachedTahunAjaranList",0,h])},22704,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(6846),f=a.i(18558),g=a.i(9343);async function h(){try{await (0,c.execute)("ALTER TABLE kelas ADD COLUMN tempat TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,c.execute)("ALTER TABLE kelas ADD COLUMN grade TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}try{await (0,c.execute)("ALTER TABLE kelas ADD COLUMN baru_lama TEXT")}catch(a){if(!String(a?.message||"").toLowerCase().includes("duplicate column name"))throw a}}async function i(){return await h(),(await (0,c.query)(`
    SELECT k.*, m.nama as marhalah_nama, ta.nama as tahun_ajaran_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function j(){return await h(),(await (0,c.query)(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tempat,
      k.grade,
      k.baru_lama,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas COLLATE NOCASE
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function k(a){return await h(),(0,c.queryOne)(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tempat,
      k.grade,
      k.baru_lama,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    WHERE k.id = ?
    LIMIT 1
  `,[a])}async function l(){return j()}async function m(a){let b=await (0,d.getSession)(),g=a.get("nama_kelas"),i=a.get("marhalah_id"),j=a.get("jenis_kelamin"),k=(a.get("tempat")||"").trim(),l=(a.get("grade")||"").trim().toUpperCase(),m=(a.get("baru_lama")||"").trim().toUpperCase();await h();let n=await (0,c.queryOne)("SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1");if(!n)return{error:"Tidak ada tahun ajaran aktif."};if(await (0,c.queryOne)("SELECT id FROM kelas WHERE nama_kelas = ? AND marhalah_id = ? AND tahun_ajaran_id = ?",[g,i,n.id]))return{error:"Kelas dengan nama ini sudah ada di marhalah tersebut."};await (0,c.query)("INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",[crypto.randomUUID(),g,i,j,k||null,l||null,m||null,n.id]);let o=await (0,c.queryOne)("SELECT nama FROM marhalah WHERE id = ?",[i]);return await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"master_kelas",action:"create",fiturHref:"/dashboard/master/kelas",logKind:"create",entityType:"kelas",entityLabel:g,summary:`Menambahkan kelas ${g}`,details:{marhalah:o?.nama||i,jenis_kelamin:j,tempat:k||null,grade:l||null,baru_lama:m||null,tahun_ajaran_id:n.id}}),(0,f.revalidatePath)("/dashboard/master/kelas"),{success:!0}}async function n(a){let b=await (0,d.getSession)(),g=await (0,c.queryOne)("SELECT id, nama_kelas, jenis_kelamin, tempat, grade, baru_lama FROM kelas WHERE id = ?",[a]);if(!g)return{error:"Kelas tidak ditemukan."};let h=await (0,c.query)("SELECT COUNT(*) as count FROM riwayat_pendidikan WHERE kelas_id = ? AND status_riwayat = ?",[a,"aktif"]);return(h[0]?.count??0)>0?{error:"Gagal hapus: Masih ada santri aktif di kelas ini. Kosongkan dulu."}:(await (0,c.query)("DELETE FROM kelas WHERE id = ?",[a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"master_kelas",action:"delete",fiturHref:"/dashboard/master/kelas",logKind:"delete",entityType:"kelas",entityId:g.id,entityLabel:g.nama_kelas,summary:`Menghapus kelas ${g.nama_kelas}`,details:{jenis_kelamin:g.jenis_kelamin,tempat:g.tempat,grade:g.grade,baru_lama:g.baru_lama}}),(0,f.revalidatePath)("/dashboard/master/kelas"),{success:!0})}async function o(a){let b=await (0,d.getSession)();await h();let i=await (0,c.queryOne)("SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1");if(!i)return{error:"Tidak ada tahun ajaran aktif."};let j=new Map((await (0,g.getCachedMarhalahList)()).map(a=>[a.nama.toLowerCase().trim(),a.id])),k=new Set((await (0,c.query)("SELECT nama_kelas, marhalah_id FROM kelas WHERE tahun_ajaran_id = ?",[i.id])).map(a=>`${a.nama_kelas.toLowerCase().trim()}-${a.marhalah_id}`)),l=[],m=[],n=0;for(let b=0;b<a.length;b++){let c=a[b],d=b+2,e=String(c["NAMA KELAS"]||c["nama kelas"]||"").trim(),f=String(c.MARHALAH||c.marhalah||"").trim(),g=String(c["JENIS KELAMIN"]||c["jenis kelamin"]||"L").toUpperCase().trim(),h=String(c.TEMPAT||c.tempat||"").trim(),o=String(c.GRADE||c.grade||"").trim().toUpperCase(),p=String(c["B/L"]||c["BARU/LAMA"]||c["baru/lama"]||c.baru_lama||"").trim().toUpperCase();if(!e||!f)continue;let q=j.get(f.toLowerCase());if(!q){m.push(`Baris ${d}: Marhalah '${f}' tidak ditemukan di sistem.`);continue}let r=`${e.toLowerCase()}-${q}`;if(k.has(r)){n++;continue}let s="L";"P"===g||"PUTRI"===g||"PEREMPUAN"===g?s="P":("C"===g||"CAMPURAN"===g)&&(s="C"),l.push([crypto.randomUUID(),e,q,s,h||null,o||null,p||null,i.id]),k.add(r)}return m.length>0?{error:`Gagal sebagian:
${m.slice(0,5).join("\n")}`}:0===l.length?n>0?{error:`Semua data (${n}) dilewati karena kelas sudah ada.`}:{error:"Tidak ada data valid untuk disimpan."}:(await (0,c.batch)(l.map(a=>({sql:"INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",params:a}))),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"master_kelas",action:"create",fiturHref:"/dashboard/master/kelas",logKind:"create",entityType:"kelas_batch",entityId:"import",entityLabel:"Import kelas massal",summary:`Import kelas massal: ${l.length} kelas ditambahkan`,details:{inserted:l.length,skipped:n,failed:m.length,tahun_ajaran_id:i.id}}),(0,f.revalidatePath)("/dashboard/master/kelas"),{success:!0,count:l.length,skipped:n})}(0,a.i(13095).ensureServerEntryExports)([i,j,k,l,m,n,o,g.getCachedTahunAjaranAktif,g.getCachedMarhalahList]),(0,b.registerServerReference)(i,"00f52ed4174afd399289dc629a5c35910fa98dbd37",null),(0,b.registerServerReference)(j,"009467770fd0a5ca930536f2296d8506b6fef8b031",null),(0,b.registerServerReference)(k,"4072b92f65de3d4d0ca19eb92f1c1328ad84586e2c",null),(0,b.registerServerReference)(l,"00ed5d4656d904f78624fb61be37e1880de2c7a10a",null),(0,b.registerServerReference)(m,"406c0e81b3701c208a475b563b323dce3e3cd4dee6",null),(0,b.registerServerReference)(n,"40a8fcdbd5dbc5311bbf2b0ec18872b8c4fbdfdcd8",null),(0,b.registerServerReference)(o,"40277ba648c2ef4612b5e165cdf439455e79d1d271",null),(0,b.registerServerReference)(g.getCachedTahunAjaranAktif,"7f0ca2f1c02510f1cb687b30bb533633ea3ed1760d",null),(0,b.registerServerReference)(g.getCachedMarhalahList,"7f7d595cda1951a39fcece9151f1d28b0522650751",null),a.s(["getKelasList",()=>i,"getKelasTempelanList",()=>j,"getTempelanKelasData",()=>k,"getTempelanKelasSemuaData",()=>l,"hapusKelas",()=>n,"importKelasMassal",()=>o,"tambahKelas",()=>m],59151),a.i(59151),a.s(["getKelasList",()=>i,"getKelasTempelanList",()=>j,"getMarhalahList",()=>g.getCachedMarhalahList,"getTahunAjaranAktif",()=>g.getCachedTahunAjaranAktif,"getTempelanKelasData",()=>k,"getTempelanKelasSemuaData",()=>l,"hapusKelas",()=>n,"importKelasMassal",()=>o,"tambahKelas",()=>m],22704)},70959,a=>{"use strict";var b=a.i(24895),c=a.i(22704);a.s([],48708),a.i(48708),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00f52ed4174afd399289dc629a5c35910fa98dbd37",()=>c.getKelasList,"40277ba648c2ef4612b5e165cdf439455e79d1d271",()=>c.importKelasMassal,"406c0e81b3701c208a475b563b323dce3e3cd4dee6",()=>c.tambahKelas,"40a8fcdbd5dbc5311bbf2b0ec18872b8c4fbdfdcd8",()=>c.hapusKelas,"7f0ca2f1c02510f1cb687b30bb533633ea3ed1760d",()=>c.getTahunAjaranAktif,"7f7d595cda1951a39fcece9151f1d28b0522650751",()=>c.getMarhalahList],70959)}];

//# sourceMappingURL=_1230ae88._.js.map