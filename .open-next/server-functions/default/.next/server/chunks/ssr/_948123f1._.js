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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},94994,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558);async function h(a){return(await (0,d.query)(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `,[`%${a}%`])).map(a=>({...a,tahun_masuk_fix:a.tahun_masuk||new Date(a.created_at).getFullYear()}))}async function i(a,b,c){let e=await (0,d.query)("SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?",[b]),f={BANGUNAN:0,KESEHATAN:0,EHB:0,EKSKUL:0};e.forEach(a=>{f[a.jenis_biaya]=a.nominal});let g=await (0,d.query)("SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?",[a]),h=g.filter(a=>"BANGUNAN"===a.jenis_biaya).reduce((a,b)=>a+b.nominal_bayar,0),i=f.BANGUNAN-h,j=a=>g.some(b=>b.jenis_biaya===a&&b.tahun_tagihan===c);return{harga_angkatan:f,bangunan:{total_wajib:f.BANGUNAN,sudah_bayar:h,sisa:i<=0?0:i,status:i<=0?"LUNAS":h>0?"CICILAN":"BELUM"},tahunan:{KESEHATAN:{nominal:f.KESEHATAN,lunas:j("KESEHATAN")},EHB:{nominal:f.EHB,lunas:j("EHB")},EKSKUL:{nominal:f.EKSKUL,lunas:j("EKSKUL")}}}}async function j(a,b,c,h,i){let j=await (0,e.getSession)(),k=await (0,d.queryOne)("SELECT nama_lengkap, nis FROM santri WHERE id = ?",[a]);return"BANGUNAN"!==b&&h&&await (0,d.queryOne)("SELECT id FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ?",[a,b,h])?{error:`Tagihan ${b} tahun ${h} sudah lunas sebelumnya.`}:(await (0,d.execute)(`
    INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
    VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
  `,[(0,d.generateId)(),a,b,h,c,j?.id??null,i]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(j),module:"keuangan_pembayaran",action:"payment",fiturHref:"/dashboard/keuangan/pembayaran",logKind:"create",entityType:"santri",entityId:a,entityLabel:k?.nama_lengkap||k?.nis||a,summary:`Mencatat pembayaran ${b} untuk ${k?.nama_lengkap||k?.nis||a}`,details:{jenis_biaya:b,nominal:c,tahun_tagihan:h,keterangan:i||null}}),(0,g.revalidatePath)("/dashboard/keuangan/pembayaran"),{success:!0})}async function k(a,b,c,e){let f=await (0,d.query)("SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings",[]),g=new Map;f.forEach(a=>{"BANGUNAN"===a.jenis_biaya&&g.set(a.tahun_angkatan,a.nominal)});let h=`SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
             FROM santri WHERE status_global = 'aktif'`,i=[];a&&"SEMUA"!==a&&(h+=" AND asrama = ?",i.push(a)),b&&"SEMUA"!==b&&(h+=" AND kamar = ?",i.push(b)),c&&(h+=" AND nama_lengkap LIKE ?",i.push(`%${c}%`)),h+=" ORDER BY nama_lengkap";let j=await (0,d.query)(h,i);if(!j.length)return[];let k=`SELECT p.santri_id, p.jenis_biaya, p.nominal_bayar, p.tahun_tagihan
                FROM pembayaran_tahunan p
                INNER JOIN santri s ON s.id = p.santri_id
                WHERE s.status_global = 'aktif'`,l=[];a&&"SEMUA"!==a&&(k+=" AND s.asrama = ?",l.push(a)),b&&"SEMUA"!==b&&(k+=" AND s.kamar = ?",l.push(b)),c&&(k+=" AND s.nama_lengkap LIKE ?",l.push(`%${c}%`));let m=await (0,d.query)(k,l),n=m.filter(a=>"BANGUNAN"===a.jenis_biaya),o=m.filter(a=>a.tahun_tagihan===e);return j.map(a=>{let b=a.tahun_masuk||new Date(a.created_at).getFullYear(),c=g.get(b)||0,d=n.filter(b=>b.santri_id===a.id).reduce((a,b)=>a+b.nominal_bayar,0),e="BELUM";c>0?d>=c?e="LUNAS":d>0&&(e="CICIL"):e="-";let f=o.filter(b=>b.santri_id===a.id),h=f.some(a=>"EHB"===a.jenis_biaya),i=f.some(a=>"KESEHATAN"===a.jenis_biaya),j=f.some(a=>"EKSKUL"===a.jenis_biaya);return{...a,tahun_masuk_fix:b,status_bangunan:e,lunas_ehb:h,lunas_kesehatan:i,lunas_ekskul:j,is_full_tahunan:h&&i&&j}})}async function l(a,b,c){let h=await (0,e.getSession)(),i=await (0,d.queryOne)("SELECT nama_lengkap, nis FROM santri WHERE id = ?",[a]),j=await (0,d.query)(`SELECT jenis_biaya, nominal FROM biaya_settings
     WHERE tahun_angkatan = ? AND jenis_biaya IN ('KESEHATAN', 'EHB', 'EKSKUL')`,[c]);if(!j.length)return{error:"Tarif belum diatur untuk angkatan ini."};let k=(await (0,d.query)("SELECT jenis_biaya FROM pembayaran_tahunan WHERE santri_id = ? AND tahun_tagihan = ?",[a,b])).map(a=>a.jenis_biaya),l=j.filter(a=>!k.includes(a.jenis_biaya)&&a.nominal>0);if(!l.length)return{error:"Santri ini sudah lunas semua tagihan tahunan."};let m=0;for(let c of l)await (0,d.execute)(`
      INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
    `,[(0,d.generateId)(),a,c.jenis_biaya,b,c.nominal,h?.id??null,`Pelunasan Otomatis ${b}`]),m+=c.nominal;return await (0,f.logActivity)({actor:(0,f.actorFromSession)(h),module:"keuangan_pembayaran",action:"payment",fiturHref:"/dashboard/keuangan/pembayaran",logKind:"create",entityType:"santri",entityId:a,entityLabel:i?.nama_lengkap||i?.nis||a,summary:`Mencatat pelunasan tahunan untuk ${i?.nama_lengkap||i?.nis||a}`,details:{tahun_tagihan:b,total_nominal:m,jenis_biaya:l.map(a=>a.jenis_biaya),count:l.length}}),(0,g.revalidatePath)("/dashboard/keuangan/pembayaran"),{success:!0,count:l.length,total:m}}(0,a.i(13095).ensureServerEntryExports)([h,i,j,k,l]),(0,c.registerServerReference)(h,"4083a36629b19ddbc798dbb543501ac0cefa150132",null),(0,c.registerServerReference)(i,"70685383bb404382a6e77ebeeb56b3b0d0b686310a",null),(0,c.registerServerReference)(j,"7c0c5909265eeacadd8e78155dce10c410a748463a",null),(0,c.registerServerReference)(k,"78abfd7055760dd1a8ab52271d89edcbc20710212f",null),(0,c.registerServerReference)(l,"70b1cb04ddf02a0cb79c8276d3e3af749113658af0",null),a.s([],81757),a.i(81757),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"70685383bb404382a6e77ebeeb56b3b0d0b686310a",()=>i,"70b1cb04ddf02a0cb79c8276d3e3af749113658af0",()=>l,"78abfd7055760dd1a8ab52271d89edcbc20710212f",()=>k,"7c0c5909265eeacadd8e78155dce10c410a748463a",()=>j],94994)}];

//# sourceMappingURL=_948123f1._.js.map