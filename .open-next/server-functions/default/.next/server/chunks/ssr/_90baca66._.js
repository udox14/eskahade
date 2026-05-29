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
  `),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[e,g]),await (0,b.execute)("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",[f,String(3)])}async function k(){await j();let[a,c]=await Promise.all([(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[e]),(0,b.queryOne)("SELECT value FROM app_settings WHERE key = ?",[f])]);return{mulaiBerlaku:l(a?.value),durasiBulan:m(c?.value)}}function l(a){let b=String(a??"").trim();return/^\d{4}-\d{2}-\d{2}$/.test(b)?b:g}function m(a){let b=Number(a);return Number.isFinite(b)?Math.min(24,Math.max(1,Math.trunc(b))):3}a.s(["KATEGORI_SANTRI_DASAR",0,c,"KATEGORI_SANTRI_EFEKTIF",0,d,"SANTRI_BARU_DURASI_KEY",0,f,"SANTRI_BARU_MULAI_KEY",0,e,"getKategoriSantriEfektifSql",()=>i,"getSantriBaruSettings",()=>k,"normalizeDurasiBulan",()=>m,"normalizeKategoriSantriDasar",()=>h,"normalizeMulaiBerlaku",()=>l])},40234,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(85972);async function g(){let a=await (0,e.getSession)(),b=a&&(0,e.hasRole)(a,"pengurus_asrama")?a.asrama_binaan??null:null,[c,f,g,h,i,j]=await Promise.all([b?Promise.resolve([b]):(0,d.query)("SELECT DISTINCT asrama AS v FROM santri WHERE status_global='aktif' AND asrama IS NOT NULL ORDER BY asrama").then(a=>a.map(a=>a.v)),(0,d.query)("SELECT DISTINCT sekolah AS v FROM santri WHERE status_global='aktif' AND sekolah IS NOT NULL ORDER BY sekolah").then(a=>a.map(a=>a.v)),(0,d.query)("SELECT DISTINCT kelas_sekolah AS v FROM santri WHERE status_global='aktif' AND kelas_sekolah IS NOT NULL ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah").then(a=>a.map(a=>a.v)),(0,d.query)("SELECT DISTINCT tahun_masuk AS v FROM santri WHERE status_global='aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC").then(a=>a.map(a=>a.v)),(0,d.query)(`
      SELECT DISTINCT m.nama AS marhalah, k.nama_kelas, m.urutan
      FROM kelas k
      INNER JOIN marhalah m ON m.id = k.marhalah_id
      WHERE EXISTS (
        SELECT 1 FROM riwayat_pendidikan rp
        INNER JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
        WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
      )
      ORDER BY m.urutan, k.nama_kelas
    `),(0,d.query)("SELECT id, nama_jasa, jenis FROM master_jasa ORDER BY jenis, nama_jasa")]),k=[...new Set(i.map(a=>a.marhalah))],l=i.map(a=>a.nama_kelas);return{asramaList:c,sekolahList:f,kelasSekolahList:g,tahunList:h,marhalahUnik:k,kelasList:l,jasaMakanList:j.filter(a=>"Makan"===a.jenis),jasaCuciList:j.filter(a=>"Cuci"===a.jenis),asramaBinaan:b}}async function h(a){let b=await (0,e.getSession)();return b&&(0,e.hasRole)(b,"pengurus_asrama")&&b.asrama_binaan!==a?[]:(await (0,d.query)(`SELECT DISTINCT kamar AS v FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,[a])).map(a=>a.v)}async function i(a,b,c){let g=await (0,e.getSession)();if(!g)return{error:"Tidak terautentikasi"};let h=(0,e.hasRole)(g,"pengurus_asrama")?g.asrama_binaan:null,i=(0,f.getKategoriSantriEfektifSql)("s"),j=(a,b)=>{b&&0!==b.length&&(o.push(`${a} IN (${b.map(()=>"?").join(", ")})`),p.push(...b))},k=(a,b)=>{if(!b||0===b.length)return;let c=b.filter(a=>"__NULL__"!==a),d=b.includes("__NULL__"),e=[];c.length>0&&(e.push(`${a} IN (${c.map(()=>"?").join(", ")})`),p.push(...c)),d&&e.push(`${a} IS NULL`),e.length>0&&o.push(`(${e.join(" OR ")})`)},l=h?[h]:a.asrama&&a.asrama.length>0?a.asrama:null,m=b.includes("nama_kelas")||b.includes("marhalah")||!!a.nama_kelas&&a.nama_kelas.length>0||!!a.marhalah&&a.marhalah.length>0,n=b.includes("tempat_makan")||b.includes("tempat_mencuci")||!!a.tempat_makan_id&&a.tempat_makan_id.length>0||!!a.tempat_mencuci_id&&a.tempat_mencuci_id.length>0,o=["s.status_global = 'aktif'"],p=[];j("s.asrama",l),j("s.kamar",a.kamar),k("s.tempat_makan_id",a.tempat_makan_id),k("s.tempat_mencuci_id",a.tempat_mencuci_id),a.jenis_kelamin&&(o.push("s.jenis_kelamin = ?"),p.push(a.jenis_kelamin)),j("s.sekolah",a.sekolah),j("s.kelas_sekolah",a.kelas_sekolah),j("s.tahun_masuk",a.tahun_masuk),a.alamat_kata&&(o.push("s.alamat LIKE ?"),p.push(`%${a.alamat_kata}%`)),j("k.nama_kelas",a.nama_kelas),j("m.nama",a.marhalah);let q=o.join(" AND "),r=m?`LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       LEFT JOIN marhalah m ON m.id = k.marhalah_id`:"",s=n?`LEFT JOIN master_jasa jm ON jm.id = s.tempat_makan_id
       LEFT JOIN master_jasa jc ON jc.id = s.tempat_mencuci_id`:"",t=["s.id AS _id",b.includes("nis")?"s.nis":null,b.includes("nama_lengkap")?"s.nama_lengkap":null,b.includes("jenis_kelamin")?"s.jenis_kelamin":null,b.includes("nik")?"s.nik":null,b.includes("tempat_lahir")?"s.tempat_lahir":null,b.includes("tanggal_lahir")?"s.tanggal_lahir":null,b.includes("nama_ayah")?"s.nama_ayah":null,b.includes("nama_ibu")?"s.nama_ibu":null,b.includes("alamat")?"s.alamat":null,b.includes("asrama")?"s.asrama":null,b.includes("kamar")?"s.kamar":null,b.includes("tahun_masuk")?"s.tahun_masuk":null,b.includes("kategori_santri")?`${i} AS kategori_santri`:null,n&&b.includes("tempat_makan")?`CASE
      WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
      WHEN jm.id IS NULL THEN 'Penyedia terhapus'
      ELSE jm.nama_jasa
    END AS tempat_makan`:null,n&&b.includes("tempat_mencuci")?`CASE
      WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
      WHEN jc.id IS NULL THEN 'Penyedia terhapus'
      ELSE jc.nama_jasa
    END AS tempat_mencuci`:null,b.includes("sekolah")?"s.sekolah":null,b.includes("kelas_sekolah")?"s.kelas_sekolah":null,m&&b.includes("nama_kelas")?"k.nama_kelas":null,m&&b.includes("marhalah")?"m.nama AS marhalah":null].filter(Boolean).join(", "),u=await (0,d.query)(`SELECT ${t}
     FROM santri s
     ${r}
     ${s}
     WHERE ${q}
     ORDER BY ${{nama_lengkap:"s.nama_lengkap",asrama:"s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap",kamar:"CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap",kelas_pesantren:m?"m.urutan, k.nama_kelas, s.nama_lengkap":"s.nama_lengkap",sekolah:"s.sekolah, CAST(s.kelas_sekolah AS INTEGER), s.nama_lengkap",tahun_masuk:"s.tahun_masuk, s.nama_lengkap",nis:"s.nis"}[c]||"s.nama_lengkap"}
     LIMIT 5000`,p),v=new Set,w=u.filter(a=>!v.has(a._id)&&(v.add(a._id),delete a._id,!0));return{rows:w,total:w.length}}(0,a.i(13095).ensureServerEntryExports)([g,h,i]),(0,c.registerServerReference)(g,"00adf1119f9d4632fbb2186bf75f243dda6ea91408",null),(0,c.registerServerReference)(h,"409e4c9cd58877f980eaefee5ee3d5ca94bca970a8",null),(0,c.registerServerReference)(i,"70859516d1a3fa379fbb9232e9cd0fd979345fa661",null),a.s([],60418),a.i(60418),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"00adf1119f9d4632fbb2186bf75f243dda6ea91408",()=>g,"409e4c9cd58877f980eaefee5ee3d5ca94bca970a8",()=>h,"70859516d1a3fa379fbb9232e9cd0fd979345fa661",()=>i],40234)}];

//# sourceMappingURL=_90baca66._.js.map