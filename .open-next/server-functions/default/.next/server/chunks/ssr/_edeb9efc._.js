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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},85972,a=>{"use strict";var b=a.i(12259);let c=["REGULER","SADESA"],d=["BARU",...c],e="santri_baru_mulai_berlaku",f="santri_baru_durasi_bulan",g="2026-07-01";function h(a){return"SADESA"===String(a??"").trim().toUpperCase()?"SADESA":"REGULER"}function i(a="s"){let b=`(SELECT value FROM app_settings WHERE key = '${e}')`,c=`(SELECT value FROM app_settings WHERE key = '${f}')`;return`CASE
    WHEN ${a}.status_global = 'aktif'
      AND ${a}.created_at IS NOT NULL
      AND date(${a}.created_at) >= date(COALESCE(${b}, '${g}'))
      AND datetime(${a}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${c}, '3') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${a}.kategori_santri, ''), 'REGULER')
  END`}async function j(){await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[e,g]),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[f,String(3)])}async function k(){await j();let[a,c]=await Promise.all([(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[e]),(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[f])]);return{mulaiBerlaku:l(a?.value),durasiBulan:m(c?.value)}}function l(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:g}function m(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}a.s(["KATEGORI_SANTRI_DASAR",0,c,"KATEGORI_SANTRI_EFEKTIF",0,d,"SANTRI_BARU_DURASI_KEY",0,f,"SANTRI_BARU_MULAI_KEY",0,e,"getKategoriSantriEfektifSql",()=>i,"getSantriBaruSettings",()=>k,"normalizeDurasiBulan",()=>m,"normalizeKategoriSantriDasar",()=>h,"normalizeMulaiBerlaku",()=>l])},44105,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(85972),h=a.i(18558);async function i(){let a=await (0,e.getSession)();return a&&(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null}function j(a,b,c=""){let d=c?`${c}.`:"",e=`WHERE ${d}asrama = ? AND ${d}status_global = 'aktif'`,f=[b];return a.kamar&&(e+=` AND ${d}kamar = ?`,f.push(a.kamar)),a.belumDitempatkan&&(e+=` AND (${d}tempat_makan_id IS NULL OR ${d}tempat_mencuci_id IS NULL)`),a.santriBaruOnly&&(e+=` AND ${(0,g.getKategoriSantriEfektifSql)(c||"santri")} = 'BARU'`),{where:e,params:f}}async function k(){let a=await (0,e.getSession)();return a&&(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null}async function l(){let a=await i();return a?[a]:(await (0,d.query)("SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama",[])).map(a=>a.asrama)}async function m(a){let b=await i();return(await (0,d.query)("SELECT DISTINCT kamar FROM santri WHERE asrama = ? AND kamar IS NOT NULL",[b??a])).map(a=>a.kamar).sort((a,b)=>a.localeCompare(b,void 0,{numeric:!0,sensitivity:"base"}))}async function n(){return(0,d.query)("SELECT * FROM master_jasa ORDER BY nama_jasa",[])}async function o(a,b){let c=await (0,e.getSession)();if(!c)throw Error("Unauthorized");let g=(0,d.generateId)();return await (0,d.execute)("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)",[g,a,b]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"asrama_layanan",action:"create",fiturHref:"/dashboard/asrama/layanan",logKind:"create",entityType:"master_jasa",entityId:g,entityLabel:a,summary:`Menambahkan master jasa ${a}`,details:{jenis:b}}),(0,h.revalidatePath)("/dashboard/asrama/layanan"),{success:!0}}async function p(a){let b=await (0,e.getSession)();if(!b)throw Error("Unauthorized");return a?.length?(await (0,d.batch)(a.map(a=>({sql:"INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)",params:[(0,d.generateId)(),a.nama_jasa,a.jenis]}))),await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_layanan",action:"create",fiturHref:"/dashboard/asrama/layanan",logKind:"create",entityType:"master_jasa_batch",entityId:"batch",entityLabel:"Tambah master jasa batch",summary:`Menambahkan ${a.length} master jasa secara batch`,details:{count:a.length}}),(0,h.revalidatePath)("/dashboard/asrama/layanan"),{success:!0,count:a.length}):{error:"Data kosong"}}async function q(a){let b=await (0,e.getSession)();if(!b)throw Error("Unauthorized");let c=(await (0,d.query)("SELECT id, nama_jasa, jenis FROM master_jasa WHERE id = ?",[a]))[0];await (0,d.execute)("DELETE FROM master_jasa WHERE id = ?",[a]),c&&await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"asrama_layanan",action:"delete",fiturHref:"/dashboard/asrama/layanan",logKind:"delete",entityType:"master_jasa",entityId:c.id,entityLabel:c.nama_jasa||c.id,summary:`Menghapus master jasa ${c.nama_jasa||c.id}`,details:{jenis:c.jenis}}),(0,h.revalidatePath)("/dashboard/asrama/layanan")}async function r({asrama:a,kamar:b,belumDitempatkan:c=!1,santriBaruOnly:e=!1,page:f=1,limit:h=20}){let k=await i()??a,l=Math.max(1,f),m=Math.max(1,h),{where:n,params:o}=j({asrama:a,kamar:b,belumDitempatkan:c,santriBaruOnly:e},k),p=(0,g.getKategoriSantriEfektifSql)("santri"),q=await (0,d.query)(`
      SELECT COUNT(*) AS total
      FROM santri
      ${n}
    `,o),r=q[0]?.total??0;return{data:await (0,d.query)(`
      SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id,
             COALESCE(NULLIF(kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${p} AS kategori_efektif
      FROM santri
      ${n}
      ORDER BY kamar, nama_lengkap
      LIMIT ? OFFSET ?
    `,[...o,m,(l-1)*m]),count:r,page:l,totalPages:Math.max(1,Math.ceil(r/m))}}async function s({asrama:a,kamar:b,belumDitempatkan:c=!1,santriBaruOnly:e=!1}){let f=await i()??a,{where:g,params:h}=j({asrama:a,kamar:b,belumDitempatkan:c,santriBaruOnly:e},f,"s");return{makan:await (0,d.query)(`
      SELECT
        s.tempat_makan_id AS jasa_id,
        CASE
          WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END AS nama_jasa,
        COUNT(*) AS total
      FROM santri s
      LEFT JOIN master_jasa m ON m.id = s.tempat_makan_id
      ${g}
      GROUP BY
        s.tempat_makan_id,
        CASE
          WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END
      ORDER BY total DESC, nama_jasa ASC
    `,h),cuci:await (0,d.query)(`
      SELECT
        s.tempat_mencuci_id AS jasa_id,
        CASE
          WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END AS nama_jasa,
        COUNT(*) AS total
      FROM santri s
      LEFT JOIN master_jasa m ON m.id = s.tempat_mencuci_id
      ${g}
      GROUP BY
        s.tempat_mencuci_id,
        CASE
          WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END
      ORDER BY total DESC, nama_jasa ASC
    `,h)}}async function t({asrama:a,kamar:b,belumDitempatkan:c=!1,santriBaruOnly:e=!1,jenis:f,jasaId:h,page:k=1,limit:l=20}){let m=await i()??a,n=Math.max(1,k),o=Math.max(1,l),{where:p,params:q}=j({asrama:a,kamar:b,belumDitempatkan:c,santriBaruOnly:e},m),r="Makan"===f?"tempat_makan_id":"tempat_mencuci_id",s=p,t=[...q];h?(s+=` AND ${r} = ?`,t.push(h)):s+=` AND ${r} IS NULL`;let u=await (0,d.query)(`
      SELECT COUNT(*) AS total
      FROM santri
      ${s}
    `,t),v=u[0]?.total??0;return{data:await (0,d.query)(`
      SELECT id, nis, nama_lengkap, asrama, kamar,
             COALESCE(NULLIF(kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${(0,g.getKategoriSantriEfektifSql)("santri")} AS kategori_efektif
      FROM santri
      ${s}
      ORDER BY kamar, nama_lengkap
      LIMIT ? OFFSET ?
    `,[...t,o,(n-1)*o]),count:v,page:n,totalPages:Math.max(1,Math.ceil(v/o))}}async function u(a,b,c){let g=await (0,e.getSession)();if(!g)throw Error("Unauthorized");if("tempat_makan_id"!==b&&"tempat_mencuci_id"!==b)return{error:"Kolom layanan tidak valid"};let i=(await (0,d.query)("SELECT id, nama_lengkap, asrama FROM santri WHERE id = ? AND status_global = ?",[a,"aktif"]))[0];return i?(0,e.hasRole)(g,"pengurus_asrama")&&g.asrama_binaan!==i.asrama?{error:"Tidak boleh mengubah santri di luar asrama binaan"}:c&&!(await (0,d.query)("SELECT id FROM master_jasa WHERE id = ? AND jenis = ?",[c,"tempat_makan_id"===b?"Makan":"Cuci"]))[0]?{error:"Penyedia jasa tidak valid"}:(await (0,d.execute)(`UPDATE santri SET ${b} = ? WHERE id = ?`,[c,a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(g),module:"asrama_layanan",action:"update",fiturHref:"/dashboard/asrama/layanan",logKind:"update",entityType:"santri_layanan",entityId:a,entityLabel:i.nama_lengkap||a,summary:`Memperbarui ${"tempat_makan_id"===b?"tempat makan":"tempat cuci"} ${i.nama_lengkap||a}`,details:{field:b,value:c}}),(0,h.revalidatePath)("/dashboard/asrama/layanan"),{success:!0}):{error:"Santri tidak ditemukan"}}(0,a.i(13095).ensureServerEntryExports)([k,l,m,n,o,p,q,r,s,t,u]),(0,c.registerServerReference)(k,"002dc1c7263e6dbdfccb968d17eede3a28e5f52937",null),(0,c.registerServerReference)(l,"008c208a400050db3753da96c82e3bcf8c759876fd",null),(0,c.registerServerReference)(m,"40e8de905e270256e0db2677060223490c1b25006e",null),(0,c.registerServerReference)(n,"00fa64d29614032d3cf6b614837d334fa0e2c488cc",null),(0,c.registerServerReference)(o,"6090f4f402602a55f193c15ea0917f8fec55530f94",null),(0,c.registerServerReference)(p,"40625d542fd06f0e1c00334d54d0016a27d05361e3",null),(0,c.registerServerReference)(q,"400378b9be83b8560fe215b9cd149f4e618a14856c",null),(0,c.registerServerReference)(r,"4050608bbd2a04a725c21b7bb4a6db6be29ee2558c",null),(0,c.registerServerReference)(s,"40375054f49b2b536ddc769c00043099e7c4f846fb",null),(0,c.registerServerReference)(t,"400a1a2532253655ed94b1bda2a9efdb653f5d278e",null),(0,c.registerServerReference)(u,"705fcee2c289b2173d7cb2efe68ade8412b3fdd23f",null),a.s([],19541),a.i(19541),a.s(["002dc1c7263e6dbdfccb968d17eede3a28e5f52937",()=>k,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"008c208a400050db3753da96c82e3bcf8c759876fd",()=>l,"00fa64d29614032d3cf6b614837d334fa0e2c488cc",()=>n,"400378b9be83b8560fe215b9cd149f4e618a14856c",()=>q,"400a1a2532253655ed94b1bda2a9efdb653f5d278e",()=>t,"40375054f49b2b536ddc769c00043099e7c4f846fb",()=>s,"4050608bbd2a04a725c21b7bb4a6db6be29ee2558c",()=>r,"40625d542fd06f0e1c00334d54d0016a27d05361e3",()=>p,"40e8de905e270256e0db2677060223490c1b25006e",()=>m,"6090f4f402602a55f193c15ea0917f8fec55530f94",()=>o,"705fcee2c289b2173d7cb2efe68ade8412b3fdd23f",()=>u],44105)}];

//# sourceMappingURL=_edeb9efc._.js.map