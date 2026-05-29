module.exports=[59398,a=>{"use strict";var b=a.i(12259),c=a.i(53058);function d(a){return{fitur_href:a.fitur_href,role:a.role,can_create:1===a.can_create,can_update:1===a.can_update,can_delete:1===a.can_delete}}async function e(){try{return(await (0,b.query)(`SELECT fitur_href, role, can_create, can_update, can_delete
       FROM role_fitur_crud_permission
       ORDER BY fitur_href, role`)).map(d)}catch(a){return console.error("[crud] getCrudPermissionsForAdmin ERROR:",a?.message),[]}}async function f(a,d,e){if(!a)return!1;if((0,c.isAdmin)(a))return!0;let f=(0,c.getEffectiveRoles)(a);if(0===f.length)return!1;let g=f.map(()=>"?").join(",");try{let a=await (0,b.queryOne)(`SELECT 1 AS allowed
       FROM role_fitur_crud_permission
       WHERE fitur_href = ?
         AND role IN (${g})
         AND ${"create"===e?"can_create":"update"===e?"can_update":"can_delete"} = 1
       LIMIT 1`,[d,...f]);return a?.allowed===1}catch(a){return console.error("[crud] canCrudForSession ERROR:",a?.message),!1}}async function g(a,b){return f(await (0,c.getSession)(),a,b)}async function h(a,b){let d=await (0,c.getSession)(),e=await f(d,a,b);return d?e?d:{error:"Akses ditolak"}:{error:"Tidak terautentikasi"}}a.s(["assertCrud",()=>h,"canCrud",()=>g,"canCrudForSession",()=>f,"getCrudPermissionsForAdmin",()=>e])},37936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(11857)},13095,(a,b,c)=>{"use strict";function d(a){for(let b=0;b<a.length;b++){let c=a[b];if("function"!=typeof c)throw Object.defineProperty(Error(`A "use server" file can only export async functions, found ${typeof c}.
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
  `),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[e,g]),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[f,String(3)])}async function k(){await j();let[a,c]=await Promise.all([(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[e]),(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[f])]);return{mulaiBerlaku:l(a?.value),durasiBulan:m(c?.value)}}function l(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:g}function m(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}a.s(["KATEGORI_SANTRI_DASAR",0,c,"KATEGORI_SANTRI_EFEKTIF",0,d,"SANTRI_BARU_DURASI_KEY",0,f,"SANTRI_BARU_MULAI_KEY",0,e,"getKategoriSantriEfektifSql",()=>i,"getSantriBaruSettings",()=>k,"normalizeDurasiBulan",()=>m,"normalizeKategoriSantriDasar",()=>h,"normalizeMulaiBerlaku",()=>l])},78224,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(59398),f=a.i(53058),g=a.i(6846),h=a.i(85972),i=a.i(18558);async function j(a,b){let c=await (0,d.queryOne)("SELECT id FROM master_jasa WHERE LOWER(nama_jasa) = LOWER(?) AND jenis = ?",[a.trim(),b]);if(c)return c.id;let e=(0,d.generateId)();return await (0,d.execute)("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)",[e,a.trim(),b]),e}async function k(){return(await (0,d.query)(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)).sort((a,b)=>a.nama_kelas.localeCompare(b.nama_kelas,void 0,{numeric:!0,sensitivity:"base"}))}async function l(a){let b=await (0,e.assertCrud)("/dashboard/santri","create");if("error"in b)return b;let c=await (0,f.getSession)();if(!a||0===a.length)return{error:"Data kosong tidak bisa disimpan."};let k=new Map((await (0,d.query)(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)).map(a=>[a.nama_kelas.trim().toLowerCase(),a.id])),l=new Date().getFullYear(),m=a.map(a=>({id:crypto.randomUUID(),nis:String(a.nis).trim(),nama_lengkap:String(a.nama_lengkap).trim(),nik:a.nik?String(a.nik).trim():null,jenis_kelamin:"P"===String(a.jenis_kelamin).toUpperCase()?"P":"L",tempat_lahir:a.tempat_lahir||null,tanggal_lahir:a.tanggal_lahir||null,nama_ayah:a.nama_ayah||null,nama_ibu:a.nama_ibu||null,alamat:a.alamat||null,gol_darah:a.gol_darah?String(a.gol_darah).toUpperCase().trim():null,alamat_lengkap:a.alamat_lengkap||null,kecamatan:a.kecamatan||null,kab_kota:a.kab_kota||null,provinsi:a.provinsi||null,jemaah:a.jemaah||null,no_wa_ortu:a.no_wa_ortu?String(a.no_wa_ortu).trim():null,tanggal_masuk:a.tanggal_masuk||`${l}-01-01`,tanggal_keluar:a.tanggal_keluar||null,status_global:"aktif",kategori_santri:(0,h.normalizeKategoriSantriDasar)(a.kategori_santri??a.sekolah),sekolah:a.sekolah?String(a.sekolah).toUpperCase().trim():null,kelas_sekolah:a.kelas_sekolah?String(a.kelas_sekolah).trim():null,asrama:a.asrama?String(a.asrama).toUpperCase().trim():null,kamar:a.kamar?String(a.kamar).trim():null,kelas_pesantren:a.kelas_pesantren?String(a.kelas_pesantren).trim():null,nama_tempat_makan:a.nama_tempat_makan?String(a.nama_tempat_makan).trim():null,nama_tempat_cuci:a.nama_tempat_cuci?String(a.nama_tempat_cuci).trim():null})),n=new Date().toISOString(),o=0;for(let a of m)try{let b=null,c=null;a.nama_tempat_makan&&(b=await j(a.nama_tempat_makan,"Makan")),a.nama_tempat_cuci&&(c=await j(a.nama_tempat_cuci,"Cuci"));let e="SADESA"===a.kategori_santri?null:a.sekolah,f="SADESA"===a.kategori_santri?null:a.kelas_sekolah;if(await (0,d.query)(`INSERT INTO santri (
          id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
          nama_ayah, nama_ibu, alamat,
          gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
          jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
          status_global, kategori_santri, sekolah, kelas_sekolah, asrama, kamar,
          tempat_makan_id, tempat_mencuci_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[a.id,a.nis,a.nama_lengkap,a.nik,a.jenis_kelamin,a.tempat_lahir,a.tanggal_lahir,a.nama_ayah,a.nama_ibu,a.alamat,a.gol_darah,a.alamat_lengkap,a.kecamatan,a.kab_kota,a.provinsi,a.jemaah,a.no_wa_ortu,a.tanggal_masuk,a.tanggal_keluar,a.status_global,a.kategori_santri,e,f,a.asrama,a.kamar,b,c,n,n]),a.kelas_pesantren){let b=k.get(a.kelas_pesantren.toLowerCase());b&&await (0,d.query)("INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)",[crypto.randomUUID(),a.id,b,"aktif",n])}o++}catch(b){if(b.message?.includes("UNIQUE"))continue;return{error:`Gagal menyimpan NIS ${a.nis}: ${b.message}`}}return(0,i.revalidatePath)("/dashboard/santri"),o>0&&await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"santri",action:"create",fiturHref:"/dashboard/santri",logKind:"create",entityType:"santri_batch",entityId:"import",entityLabel:"Import santri massal",summary:`Import santri massal: ${o} data ditambahkan`,details:{inserted:o,attempted:m.length,skipped:m.length-o}}),{success:!0,count:o}}async function m(a){let b=await (0,e.assertCrud)("/dashboard/santri","create");if("error"in b)return b;let c=await (0,f.getSession)(),{nis:k,nama_lengkap:l,kelas_pesantren:m,nama_tempat_makan:n,nama_tempat_cuci:o,...p}=a;if(!k||!l)return{error:"NIS dan Nama wajib diisi."};if(await (0,d.queryOne)("SELECT id FROM santri WHERE nis = ?",[k.trim()]))return{error:`NIS ${k} sudah terdaftar di database.`};let q=crypto.randomUUID(),r=new Date().toISOString(),s=new Date().getFullYear(),t=(0,h.normalizeKategoriSantriDasar)(a.kategori_santri),u="SADESA"===t?null:p.sekolah?.toUpperCase().trim()||null,v="SADESA"===t?null:p.kelas_sekolah?.trim()||null,w=null,x=null;if(n?.trim()&&(w=await j(n,"Makan")),o?.trim()&&(x=await j(o,"Cuci")),await (0,d.query)(`INSERT INTO santri (
      id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
      nama_ayah, nama_ibu, alamat,
      gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
      jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
      kategori_santri, sekolah, kelas_sekolah, asrama, kamar,
      tempat_makan_id, tempat_mencuci_id,
      status_global, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[q,k.trim(),l.trim(),p.nik?.trim()||null,p.jenis_kelamin,p.tempat_lahir?.trim()||null,p.tanggal_lahir||null,p.nama_ayah?.trim()||null,p.nama_ibu?.trim()||null,p.alamat?.trim()||null,p.gol_darah?.toUpperCase().trim()||null,p.alamat_lengkap?.trim()||null,p.kecamatan?.trim()||null,p.kab_kota?.trim()||null,p.provinsi?.trim()||null,p.jemaah?.trim()||null,p.no_wa_ortu?.trim()||null,p.tanggal_masuk||`${s}-01-01`,p.tanggal_keluar||null,t,u,v,p.asrama?.toUpperCase().trim()||null,p.kamar?.trim()||null,w,x,"aktif",r,r]),m?.trim()){let a=await (0,d.queryOne)(`
      SELECT k.id FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE LOWER(k.nama_kelas) = LOWER(?)
      LIMIT 1
    `,[m.trim()]);a&&await (0,d.query)("INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)",[crypto.randomUUID(),q,a.id,"aktif",r])}return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c),module:"santri",action:"create",fiturHref:"/dashboard/santri",logKind:"create",entityType:"santri",entityId:q,entityLabel:l.trim(),summary:`Menambahkan santri ${l.trim()}`,details:{nis:k.trim(),kategori_santri:t,sekolah:u,kelas_sekolah:v,asrama:p.asrama?.toUpperCase().trim()||null,kamar:p.kamar?.trim()||null,kelas_pesantren:m?.trim()||null}}),(0,i.revalidatePath)("/dashboard/santri"),{success:!0}}(0,a.i(13095).ensureServerEntryExports)([k,l,m]),(0,c.registerServerReference)(k,"00bb56af57077da873bd4eff2862db09612c3b4001",null),(0,c.registerServerReference)(l,"408549d9bb0b6b54b2dd4114196e737c9c229098ee",null),(0,c.registerServerReference)(m,"40145b51bff983695bd868712b79f51e6f1590f1ce",null),a.s([],60014),a.i(60014),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00bb56af57077da873bd4eff2862db09612c3b4001",()=>k,"40145b51bff983695bd868712b79f51e6f1590f1ce",()=>m,"408549d9bb0b6b54b2dd4114196e737c9c229098ee",()=>l],78224)}];

//# sourceMappingURL=_e8b2bd80._.js.map