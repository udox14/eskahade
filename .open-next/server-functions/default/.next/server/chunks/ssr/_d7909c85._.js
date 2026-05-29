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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[(0,c.generateId)(),new Date().toISOString(),f?.id??null,f?.name??f?.email??null,!(b=f?.roles)||0===b.length?null:JSON.stringify(b),a.module,a.action,a.entityType??null,a.entityId??null,a.entityLabel??null,g(a.summary,300),!(d=a.details)?null:JSON.stringify(h(d)),a.status??"success",e.ipAddress??null,e.userAgent??null])}catch(a){console.error("[activity-log] gagal menulis log:",a instanceof Error?a.message:String(a))}}function p(a,b,c){let d={};for(let e of c){let c=a[e],f=b[e];JSON.stringify(c)!==JSON.stringify(f)&&(d[e]={before:h(c),after:h(f)})}return d}a.s(["actorFromSession",()=>i,"diffWhitelistedFields",()=>p,"ensureActivityLogSchema",()=>k,"getActivityLogConfigs",()=>m,"getRequestAuditContext",()=>j,"logActivity",()=>o,"updateActivityLogConfig",()=>n])},24895,a=>{"use strict";var b=a.i(37936),c=a.i(53058),d=a.i(6846);a.i(70396);var e=a.i(73727),f=a.i(18558);async function g(){let a=await (0,c.getSession)();await (0,d.logActivity)({actor:(0,d.actorFromSession)(a),module:"auth",action:"logout",entityType:"session",entityId:a?.id??null,entityLabel:a?.full_name||a?.email||"Unknown user",summary:"Logout berhasil",details:{email:a?.email??null},status:"success",requestInfo:await (0,d.getRequestAuditContext)()}),await (0,c.clearSession)(),(0,f.revalidatePath)("/","layout"),(0,e.redirect)("/login")}(0,a.i(13095).ensureServerEntryExports)([g]),(0,b.registerServerReference)(g,"003144417e19712e947907ca31b6b39c8aa99a63df",null),a.s(["signOut",()=>g])},18635,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);let i="/dashboard/akademik/upk/belanja";function j(a){let b=parseInt(String(a??"0"),10);return Number.isFinite(b)?b:0}function k(a,b){return b<=0?"HUTANG":b>=a?"LUNAS":"SEBAGIAN"}async function l(){return(await (0,d.query)(`
    SELECT uk.id, uk.nama_kitab, uk.marhalah_id, uk.harga_beli, uk.harga_jual,
           uk.stok_lama, uk.stok_baru, uk.toko_id,
           m.nama AS marhalah_nama, t.nama AS toko_nama
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    WHERE uk.is_active = 1
    ORDER BY m.urutan, uk.nama_kitab
  `,[])).map(a=>({...a,jumlah_stok:(a.stok_lama||0)+(a.stok_baru||0)}))}async function m(){return(0,d.query)("SELECT id, nama FROM upk_toko WHERE is_active = 1 ORDER BY nama",[])}async function n(a){let b=Math.max(1,Math.min(100,j(a)));return(await (0,d.query)(`
    SELECT uk.id AS katalog_id, uk.nama_kitab, uk.marhalah_id, uk.stok_lama, uk.stok_baru, uk.harga_beli,
           t.nama AS toko_nama,
           m.nama AS marhalah_nama, COUNT(DISTINCT s.id) AS jumlah_santri
    FROM upk_katalog uk
    LEFT JOIN marhalah m ON m.id = uk.marhalah_id
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN kelas k ON k.marhalah_id = uk.marhalah_id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    WHERE uk.is_active = 1
    GROUP BY uk.id
    ORDER BY m.urutan, uk.nama_kitab
  `,[])).map(a=>{let c=j(a.jumlah_santri),d=j(a.stok_lama),e=Math.max(0,Math.ceil(c*b/100)-d);return{katalog_id:a.katalog_id,nama_kitab:a.nama_kitab,marhalah_id:a.marhalah_id,marhalah_nama:a.marhalah_nama,toko_nama:a.toko_nama,jumlah_santri:c,stok_lama:d,stok_baru:j(a.stok_baru),persen_target:b,saran_qty:e,qty_rencana:e,harga_beli:j(a.harga_beli),subtotal:e*j(a.harga_beli)}})}async function o(a){let b=await (0,e.getSession)(),c=a.items.filter(a=>j(a.qtyRencana)>0);if(!c.length)return{error:"Tidak ada item rencana yang qty-nya lebih dari 0."};let h=(0,d.generateId)(),k=Math.max(1,Math.min(100,j(a.persenTarget)));for(let e of(await (0,d.execute)(`
    INSERT INTO upk_rencana_belanja
      (id, tanggal, nama, persen_target, status, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)
  `,[h,(0,d.today)(),a.nama.trim()||`Rencana ${(0,d.today)()}`,k,a.catatan?.trim()||null,b?.id??null,(0,d.now)(),(0,d.now)()]),c)){let a=Math.max(0,j(e.qtyRencana)),b=Math.max(0,j(e.hargaBeli));await (0,d.execute)(`
      INSERT INTO upk_rencana_belanja_item
        (id, rencana_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama,
         jumlah_santri, stok_lama, stok_baru, persen_target, saran_qty, qty_rencana,
         harga_beli, subtotal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[(0,d.generateId)(),h,e.katalogId,e.namaKitab,e.marhalahId,e.marhalahNama,j(e.jumlahSantri),j(e.stokLama),j(e.stokBaru),k,j(e.saranQty),a,b,a*b,(0,d.now)(),(0,d.now)()])}return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_belanja",action:"create",fiturHref:"/dashboard/akademik/upk/belanja",logKind:"create",entityType:"upk_rencana_belanja",entityId:h,entityLabel:a.nama.trim()||`Rencana ${(0,d.today)()}`,summary:`Membuat rencana belanja UPK ${c.length} item`,details:{persen_target:k,total_item:c.length,total_estimasi:c.reduce((a,b)=>a+Math.max(0,j(b.qtyRencana))*Math.max(0,j(b.hargaBeli)),0)}}),(0,g.revalidatePath)(i),{success:!0}}async function p(){return(0,d.query)(`
    SELECT r.*, COUNT(i.id) AS total_item, COALESCE(SUM(i.subtotal), 0) AS total_estimasi
    FROM upk_rencana_belanja r
    LEFT JOIN upk_rencana_belanja_item i ON i.rencana_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT 20
  `,[])}async function q(a){let b=await (0,e.getSession)(),c=a.items.filter(a=>j(a.qty)>0);if(!c.length)return{error:"Pilih minimal satu kitab yang dibeli."};let h=a.tokoId?await (0,d.queryOne)("SELECT id, nama FROM upk_toko WHERE id = ?",[a.tokoId]):null,l=c.reduce((a,b)=>a+j(b.qty)*j(b.hargaBeli),0),m=Math.max(0,Math.min(l,j(a.dibayar))),n=Math.max(0,l-m),o=k(l,m),p=(0,d.generateId)(),q=a.tanggal||(0,d.today)();for(let e of(await (0,d.execute)(`
    INSERT INTO upk_belanja
      (id, tanggal, jenis, toko_id, toko_nama, status_pembayaran, total, dibayar, sisa_hutang, catatan, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,[p,q,a.jenis,h?.id??null,h?.nama??a.tokoNama??null,o,l,m,n,a.catatan?.trim()||null,b?.id??null,(0,d.now)(),(0,d.now)()]),c)){let a=Math.max(0,j(e.qty)),b=Math.max(0,j(e.hargaBeli));await (0,d.execute)(`
      INSERT INTO upk_belanja_item
        (id, belanja_id, katalog_id, nama_kitab, marhalah_id, marhalah_nama, qty, harga_beli, subtotal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[(0,d.generateId)(),p,e.katalogId,e.namaKitab,e.marhalahId,e.marhalahNama,a,b,a*b,(0,d.now)(),(0,d.now)()]),await (0,d.execute)(`
      UPDATE upk_katalog
      SET stok_baru = stok_baru + ?, harga_beli = ?, toko_id = COALESCE(?, toko_id),
          stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `,[a,b,h?.id??null,(0,d.now)(),(0,d.now)(),e.katalogId])}return await (0,f.logActivity)({actor:(0,f.actorFromSession)(b),module:"akademik_upk_belanja",action:"create",fiturHref:"/dashboard/akademik/upk/belanja",logKind:"create",entityType:"upk_belanja",entityId:p,entityLabel:h?.nama??a.tokoNama??`Belanja ${q}`,summary:`Mencatat belanja UPK ${c.length} item`,details:{tanggal:q,jenis:a.jenis,toko:h?.nama??a.tokoNama??null,total:l,dibayar:m,sisa_hutang:n}}),(0,g.revalidatePath)(i),(0,g.revalidatePath)("/dashboard/akademik/upk/katalog"),{success:!0}}async function r(){return(0,d.query)(`
    SELECT b.*, COUNT(i.id) AS total_item
    FROM upk_belanja b
    LEFT JOIN upk_belanja_item i ON i.belanja_id = b.id
    GROUP BY b.id
    ORDER BY b.tanggal DESC, b.created_at DESC
    LIMIT 50
  `,[])}async function s(){return(0,d.query)(`
    SELECT *
    FROM upk_belanja
    WHERE sisa_hutang > 0
    ORDER BY tanggal ASC, created_at ASC
  `,[])}async function t(a,b){let c=await (0,e.getSession)(),h=await (0,d.queryOne)("SELECT * FROM upk_belanja WHERE id = ?",[a]);if(!h)return{error:"Data belanja tidak ditemukan."};let l=Math.max(0,j(b));if(l<=0)return{error:"Nominal bayar harus lebih dari 0."};let m=Math.min(h.total,h.dibayar+l),n=Math.max(0,h.total-m);return await (0,d.execute)("UPDATE upk_belanja SET dibayar = ?, sisa_hutang = ?, status_pembayaran = ?, updated_at = ? WHERE id = ?",[m,n,k(h.total,m),(0,d.now)(),a]),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"akademik_upk_belanja",action:"payment",fiturHref:"/dashboard/akademik/upk/belanja",logKind:"update",entityType:"upk_belanja",entityId:a,entityLabel:"Pembayaran hutang belanja",summary:`Membayar hutang belanja UPK sebesar ${l}`,details:{nominal_bayar:l,dibayar_sebelumnya:h.dibayar,dibayar_setelah:m,sisa_hutang:n}}),(0,g.revalidatePath)(i),{success:!0}}(0,h.ensureServerEntryExports)([l,m,n,o,p,q,r,s,t]),(0,c.registerServerReference)(l,"00fd589579e9af777096ef0a177a27c940c6e1be30",null),(0,c.registerServerReference)(m,"0070421fe9f78bffcea9bd1625814199f0db1379df",null),(0,c.registerServerReference)(n,"4036e8a20eab69c02f468cbdd6028e37d4362dae69",null),(0,c.registerServerReference)(o,"40e598073c9ca1e90f84c095d3725a1c7b103eea77",null),(0,c.registerServerReference)(p,"00cd6a31a97ab6d2daf57a9ee8525ebf2281c8943c",null),(0,c.registerServerReference)(q,"4092daaab1dc8cceb51372a29ecf11f12acc95340a",null),(0,c.registerServerReference)(r,"00197acd48040a1296a971330862355e219da9e570",null),(0,c.registerServerReference)(s,"005c29be8afbfe826e135e85a7fdf20666ba34e2f1",null),(0,c.registerServerReference)(t,"60ac7ef68ddf6773c38d06601353f1729d2c76f82c",null),a.s([],22642),a.i(22642),a.s(["00197acd48040a1296a971330862355e219da9e570",()=>r,"003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"005c29be8afbfe826e135e85a7fdf20666ba34e2f1",()=>s,"0070421fe9f78bffcea9bd1625814199f0db1379df",()=>m,"00cd6a31a97ab6d2daf57a9ee8525ebf2281c8943c",()=>p,"00fd589579e9af777096ef0a177a27c940c6e1be30",()=>l,"4036e8a20eab69c02f468cbdd6028e37d4362dae69",()=>n,"4092daaab1dc8cceb51372a29ecf11f12acc95340a",()=>q,"40e598073c9ca1e90f84c095d3725a1c7b103eea77",()=>o,"60ac7ef68ddf6773c38d06601353f1729d2c76f82c",()=>t],18635)}];

//# sourceMappingURL=_d7909c85._.js.map