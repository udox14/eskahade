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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},93348,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(6846),f=a.i(18558),g=a.i(13095);let h={pengajian:"/dashboard/akademik/absensi/vonis-final",berjamaah:"/dashboard/keamanan/verifikasi-berjamaah"},i=["shubuh","ashar","maghrib"],j=["shubuh","dzuhur","ashar","maghrib","isya"];function k(a){return new Date(`${a}T12:00:00.000Z`)}function l(a){return a.toISOString().slice(0,10)}async function m(){await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS verifikasi_panggilan_vonis (
      id TEXT PRIMARY KEY,
      panggilan_id TEXT NOT NULL REFERENCES verifikasi_panggilan(id),
      periode_awal TEXT NOT NULL,
      periode_akhir TEXT NOT NULL,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      source TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      sesi TEXT NOT NULL,
      status_final TEXT NOT NULL,
      catatan TEXT,
      pelanggaran_id TEXT REFERENCES pelanggaran(id),
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(panggilan_id, source, tanggal, sesi)
    )
  `),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_periode ON verifikasi_panggilan_vonis(periode_awal, periode_akhir, source)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_status ON verifikasi_panggilan_vonis(status_final)"),await (0,c.execute)("CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_santri ON verifikasi_panggilan_vonis(santri_id)");try{await (0,c.execute)("ALTER TABLE absen_berjamaah ADD COLUMN dzuhur TEXT")}catch{}}function n(a,b,c,d){return`${a}|${b}|${c}|${d}`}async function o(a,b){let d=await (0,c.queryOne)(`
    SELECT ah.id
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif' AND ah.tanggal = ?
    LIMIT 1
  `,[a,b]);return d?.id||null}async function p(a){let b=await o(a.santriId,a.tanggal);if(!b)return;let{statusColumn:d,verifColumn:e}=function(a){if(!i.includes(a))throw Error(`Sesi pengajian tidak valid: ${a}`);return{statusColumn:a,verifColumn:`verif_${a}`}}(a.sesi);if("MANGKIR"===a.status)return;if("ALFA"===a.status)return void await (0,c.execute)(`UPDATE absensi_harian SET ${e} = 'OK' WHERE id = ?`,[b]);let f="IZIN"===a.status?"I":"SAKIT"===a.status?"S":"H";await (0,c.execute)(`UPDATE absensi_harian SET ${d} = ?, ${e} = NULL WHERE id = ?`,[f,b])}async function q(a){if("MANGKIR"===a.status||"ALFA"===a.status)return;let b=function(a){if(!j.includes(a))throw Error(`Waktu berjamaah tidak valid: ${a}`);return a}(a.sesi);if("HADIR"===a.status){await (0,c.execute)(`UPDATE absen_berjamaah SET ${b} = NULL WHERE santri_id = ? AND tanggal = ?`,[a.santriId,a.tanggal]),await (0,c.execute)(`
      DELETE FROM absen_berjamaah
      WHERE santri_id = ? AND tanggal = ?
        AND shubuh IS NULL AND dzuhur IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL
    `,[a.santriId,a.tanggal]);return}let e="IZIN"===a.status?"P":"S",f=await (0,d.getSession)();await (0,c.execute)(`
    INSERT INTO absen_berjamaah (santri_id, tanggal, ${b}, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(santri_id, tanggal) DO UPDATE SET ${b} = excluded.${b}
  `,[a.santriId,a.tanggal,e,f?.id??null])}async function r(a,b){if("ALFA"!==a.status||b)return b;let e=await (0,d.getSession)(),f=(0,c.generateId)(),g="pengajian"===a.source?"ALFA_PENGAJIAN":"ALFA_BERJAMAAH",h="pengajian"===a.source?"Alfa Pengajian":"Alfa Berjamaah",i=`${a.tanggal} (${a.sesi})`;return await (0,c.execute)(`
    INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
    VALUES (?, ?, ?, ?, ?, 10, ?)
  `,[f,a.santriId,(0,c.now)(),g,`${h}.
Detail: ${i}`,e?.id??null]),f}async function s(a,b,d={}){let e,f,g,h;await m();let{start:i,end:j}=(g=(f=k(b)).getUTCDay(),f.setUTCDate(f.getUTCDate()-(g>=3?g-3:g+4)),{start:h=l(f),end:((e=k(h)).setUTCDate(e.getUTCDate()+6),l(e))}),o=await (0,c.query)(`
    SELECT vp.id AS panggilan_id, vp.periode_awal, vp.periode_akhir, vp.santri_id,
           vp.snapshot_json, vp.catatan AS catatan_panggilan,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM verifikasi_panggilan vp
    JOIN santri s ON s.id = vp.santri_id
    WHERE vp.periode_awal = ? AND vp.periode_akhir = ? AND vp.keputusan = 'DIPANGGIL'
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `,[i,j]);if(!o.length)return{periode:{start:i,end:j},rows:[]};let p=o.map(a=>a.panggilan_id),q=p.map(()=>"?").join(","),r=new Map((await (0,c.query)(`
    SELECT panggilan_id, source, tanggal, sesi, status_final, catatan
    FROM verifikasi_panggilan_vonis
    WHERE panggilan_id IN (${q}) AND source = ?
  `,[...p,a])).map(a=>[n(a.panggilan_id,a.source,a.tanggal,a.sesi),a])),t=[];for(let b of o){let c=function(a){try{return JSON.parse(a)}catch{return{events:[]}}}(b.snapshot_json);for(let d of(c.events||[]).filter(b=>b.source===a&&!1!==b.counted)){let e=n(b.panggilan_id,a,d.tanggal,d.sesi),f=r.get(e);t.push({key:e,panggilan_id:b.panggilan_id,santri_id:b.santri_id,nama:c.nama||b.nama_lengkap,nis:c.nis??b.nis??null,asrama:c.asrama??b.asrama??null,kamar:c.kamar??b.kamar??null,periode_awal:b.periode_awal,periode_akhir:b.periode_akhir,source:a,tanggal:d.tanggal,sesi:d.sesi,catatan_panggilan:b.catatan_panggilan??null,final_status:f?.status_final??null,final_catatan:f?.catatan??null})}}let u=d.status||"BELUM",v=(d.search||"").trim().toLowerCase();return{periode:{start:i,end:j},rows:t.filter(a=>(!d.asrama||a.asrama===d.asrama)&&(!v||!!a.nama.toLowerCase().includes(v)||!!(a.nis||"").includes(v))&&("BELUM"===u?!a.final_status:"MANGKIR"===u?"MANGKIR"===a.final_status:"SELESAI"!==u||!!a.final_status&&"MANGKIR"!==a.final_status))}}async function t(a){await m();let b=await (0,d.getSession)();if(!b)return{error:"Unauthorized"};if(!a.length)return{error:"Tidak ada vonis untuk disimpan."};let g=(0,c.now)(),i=[];for(let d of a){let a=await (0,c.queryOne)(`
      SELECT id, pelanggaran_id
      FROM verifikasi_panggilan_vonis
      WHERE panggilan_id = ? AND source = ? AND tanggal = ? AND sesi = ?
    `,[d.panggilanId,d.source,d.tanggal,d.sesi]);"pengajian"===d.source?await p(d):await q(d);let e=await r(d,a?.pelanggaran_id??null);i.push({sql:`
        INSERT INTO verifikasi_panggilan_vonis
          (id, panggilan_id, periode_awal, periode_akhir, santri_id, source, tanggal, sesi,
           status_final, catatan, pelanggaran_id, verified_by, verified_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(panggilan_id, source, tanggal, sesi) DO UPDATE SET
          status_final = excluded.status_final,
          catatan = excluded.catatan,
          pelanggaran_id = excluded.pelanggaran_id,
          verified_by = excluded.verified_by,
          verified_at = excluded.verified_at,
          updated_at = excluded.updated_at
      `,params:[(0,c.generateId)(),d.panggilanId,d.periodeAwal,d.periodeAkhir,d.santriId,d.source,d.tanggal,d.sesi,d.status,d.catatan?.trim()||null,e,b.id,g,g]})}for(let a=0;a<i.length;a+=50)await (0,c.batch)(i.slice(a,a+50));let j=a[0]?.source||"pengajian";return await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"pengajian"===j?"akademik_absensi_vonis_final":"keamanan_berjamaah_vonis_final",action:"approval",fiturHref:h[j],logKind:"update",entityType:"verifikasi_panggilan_vonis_batch",entityId:`${j}:${g}`,entityLabel:"pengajian"===j?"Vonis final pengajian":"Vonis final berjamaah",summary:`Menyimpan ${a.length} vonis final ${j}`,details:{total:a.length,alfa:a.filter(a=>"ALFA"===a.status).length,izin:a.filter(a=>"IZIN"===a.status).length,sakit:a.filter(a=>"SAKIT"===a.status).length,hadir:a.filter(a=>"HADIR"===a.status).length,mangkir:a.filter(a=>"MANGKIR"===a.status).length}}),(0,f.revalidatePath)(h[j]),(0,f.revalidatePath)("/dashboard/keamanan/verifikasi-panggilan"),(0,f.revalidatePath)("/dashboard/keamanan"),{success:!0,count:a.length}}(0,g.ensureServerEntryExports)([s,t]),(0,b.registerServerReference)(s,"705ca40e6c3c933d34843f0d9f26b2d0d667bc2a8f",null),(0,b.registerServerReference)(t,"40d4688dd333c07a1ee67e62d4bc82de30584c36fe",null),a.s(["getFinalVonisQueue",()=>s,"simpanFinalVonis",()=>t])},1255,a=>{"use strict";var b=a.i(24895),c=a.i(93348);a.s([],75255),a.i(75255),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"40d4688dd333c07a1ee67e62d4bc82de30584c36fe",()=>c.simpanFinalVonis,"705ca40e6c3c933d34843f0d9f26b2d0d667bc2a8f",()=>c.getFinalVonisQueue],1255)}];

//# sourceMappingURL=_5b8d5ab4._.js.map