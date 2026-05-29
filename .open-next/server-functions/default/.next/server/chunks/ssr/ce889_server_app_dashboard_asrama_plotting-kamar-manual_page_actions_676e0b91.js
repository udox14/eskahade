module.exports=[56435,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(18558),e=a.i(4552),f=a.i(53058),g=a.i(6846),h=a.i(12259),i=a.i(53457),j=a.i(85972),k=a.i(13095);let l="/dashboard/asrama/plotting-kamar-manual",m="/dashboard/asrama/kamar";async function n(){let a=await (0,h.getDB)();await a.batch([a.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),a.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_draft (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        kamar_lama  TEXT,
        kamar_baru  TEXT NOT NULL,
        applied     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, santri_id)
      )
    `),a.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_ketua (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        nomor_kamar TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `)]);let b=await (0,h.query)("PRAGMA table_info(kamar_config)");b.some(a=>"blok"===a.name)||await (0,h.execute)("ALTER TABLE kamar_config ADD COLUMN blok TEXT"),b.some(a=>"reserved_baru"===a.name)||await (0,h.execute)("ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0")}async function o(a){await n();let b=await (0,e.assertFeature)(l);if("error"in b)return b;let c=String(a??"").trim();if(!c)return{error:"Asrama wajib dipilih"};if((0,i.isAsramaTanpaKamar)(c))return{error:"Asrama ini tidak memakai fitur kamar"};if(!(0,f.isAdmin)(b)){if(!(0,f.hasRole)(b,"pengurus_asrama"))return{error:"Unauthorized"};if(!b.asrama_binaan)return{error:"Asrama binaan akun belum diset"};if(b.asrama_binaan!==c)return{error:"Anda hanya boleh mengelola asrama binaan Anda"}}return{session:b,asrama:c}}function p(a){let b=Number(a.kuota??0),c=Number(a.reserved_baru??0);return{nomor_kamar:String(a.nomor_kamar),kuota:b,reserved_baru:c,kuota_lama:Math.max(0,b-c),kuota_baru:c,blok:a.blok??""}}async function q(a,b){return(0,h.queryOne)("SELECT nomor_kamar, kuota, reserved_baru FROM kamar_config WHERE asrama = ? AND nomor_kamar = ?",[a,b])}async function r(a){await (0,h.execute)(`
    DELETE FROM kamar_ketua
    WHERE asrama = ?
      AND (
        nomor_kamar NOT IN (SELECT nomor_kamar FROM kamar_config WHERE asrama = ?)
        OR santri_id NOT IN (
          SELECT kd.santri_id
          FROM kamar_draft kd
          WHERE kd.asrama = ? AND kd.kamar_baru = kamar_ketua.nomor_kamar
        )
      )
  `,[a,a,a])}async function s(a){let b=await o(a);if("error"in b)return{error:b.error,configs:[],drafts:[],ketuaList:[],santriList:[],defaultConfigs:[]};await r(b.asrama);let c=(0,j.getKategoriSantriEfektifSql)("s"),[d,e,f,g,i]=await Promise.all([(0,h.query)("SELECT nomor_kamar, kuota, reserved_baru, blok FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar",[b.asrama]),(0,h.query)("SELECT santri_id, kamar_lama, kamar_baru, applied FROM kamar_draft WHERE asrama = ? ORDER BY created_at",[b.asrama]),(0,h.query)(`
      SELECT kk.nomor_kamar, kk.santri_id, s.nama_lengkap
      FROM kamar_ketua kk
      JOIN santri s ON s.id = kk.santri_id AND s.status_global = 'aktif' AND s.asrama = kk.asrama
      WHERE kk.asrama = ?
    `,[b.asrama]),(0,h.query)(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin,
             s.kamar AS kamar_asli, s.sekolah, s.kelas_sekolah,
             COALESCE(NULLIF(s.kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${c} AS kategori_efektif,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' AND s.asrama = ?
      ORDER BY s.nama_lengkap
    `,[b.asrama]),(0,h.query)(`
      SELECT TRIM(kamar) AS nomor_kamar, COUNT(*) AS kuota_lama
      FROM santri
      WHERE status_global = 'aktif'
        AND asrama = ?
        AND kamar IS NOT NULL
        AND TRIM(kamar) <> ''
      GROUP BY TRIM(kamar)
      ORDER BY CAST(TRIM(kamar) AS INTEGER), TRIM(kamar)
    `,[b.asrama])]),k=d.length?d.map(p):i.map(a=>({nomor_kamar:a.nomor_kamar,kuota_lama:Number(a.kuota_lama)||1,kuota_baru:0,kuota:Number(a.kuota_lama)||1,reserved_baru:0,blok:""}));return{configs:d.map(p),drafts:e,ketuaList:f,santriList:g,defaultConfigs:k}}async function t(a,b){let c=await o(a);if("error"in c)return c;let e=function(a){if(!a.length)return{error:"Tambahkan minimal 1 kamar"};let b=new Set,c=a.map(a=>({nomor_kamar:String(a.nomor_kamar??"").trim(),kuota_lama:Number(a.kuota_lama??0),kuota_baru:Number(a.kuota_baru??0),blok:a.blok?String(a.blok).trim().toUpperCase():""}));for(let a of c){if(!a.nomor_kamar)return{error:"Nomor kamar tidak boleh kosong"};if(b.has(a.nomor_kamar))return{error:`Nomor kamar ${a.nomor_kamar} duplikat`};if(b.add(a.nomor_kamar),!Number.isInteger(a.kuota_lama)||a.kuota_lama<0||a.kuota_lama>50)return{error:`Kuota santri lama kamar ${a.nomor_kamar} harus 0-50`};if(!Number.isInteger(a.kuota_baru)||a.kuota_baru<0||a.kuota_baru>50)return{error:`Kuota santri baru kamar ${a.nomor_kamar} harus 0-50`};if(a.kuota_lama+a.kuota_baru<1)return{error:`Total kuota kamar ${a.nomor_kamar} minimal 1`}}return c}(b);if("error"in e)return e;let f=e.map(a=>a.nomor_kamar),i=f.map(()=>"?").join(","),j=await (0,h.getDB)();return await j.batch([j.prepare("DELETE FROM kamar_config WHERE asrama = ?").bind(c.asrama),...e.map(a=>j.prepare("INSERT INTO kamar_config (asrama, nomor_kamar, kuota, reserved_baru, blok) VALUES (?, ?, ?, ?, ?)").bind(c.asrama,a.nomor_kamar,a.kuota_lama+a.kuota_baru,a.kuota_baru,a.blok||null)),j.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND kamar_baru NOT IN (${i})`).bind(c.asrama,...f),j.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar NOT IN (${i})`).bind(c.asrama,...f)]),await r(c.asrama),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c.session),module:"plotting_kamar_manual",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_config_batch",entityId:c.asrama,entityLabel:c.asrama,summary:`Memperbarui konfigurasi plotting manual asrama ${c.asrama}`,details:{total_kamar:e.length}}),(0,d.revalidatePath)(l),(0,d.revalidatePath)(m),{success:!0}}async function u(a,b){let c=await o(a);if("error"in c)return c;let[e,f]=await Promise.all([(0,h.query)("SELECT nomor_kamar FROM kamar_config WHERE asrama = ?",[c.asrama]),(0,h.query)("SELECT id, kamar FROM santri WHERE status_global = ? AND asrama = ?",["aktif",c.asrama])]);if(!e.length)return{error:"Simpan konfigurasi kamar dulu"};let i=new Set(e.map(a=>a.nomor_kamar)),j="prefill"===b?f.filter(a=>i.has(String(a.kamar??"").trim())):[],k=await (0,h.getDB)(),m=[k.prepare("DELETE FROM kamar_draft WHERE asrama = ?").bind(c.asrama),k.prepare("DELETE FROM kamar_ketua WHERE asrama = ?").bind(c.asrama),...j.map(a=>k.prepare(`
        INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
        VALUES (?, ?, ?, ?, 0)
      `).bind(c.asrama,a.id,a.kamar||null,String(a.kamar).trim()))];for(let a=0;a<m.length;a+=100)await k.batch(m.slice(a,a+100));return await (0,g.logActivity)({actor:(0,g.actorFromSession)(c.session),module:"plotting_kamar_manual",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_draft",entityId:c.asrama,entityLabel:c.asrama,summary:`Membuat draft plotting manual asrama ${c.asrama}`,details:{mode:b,total_prefill:j.length}}),(0,d.revalidatePath)(l),{success:!0,total:j.length}}async function v(a,b,c){let e=await o(a);if("error"in e)return e;let f=String(b??"").trim();if(!f)return{error:"Kamar wajib dipilih"};let i=await q(e.asrama,f);if(!i)return{error:"Kamar tidak ada di konfigurasi"};let k=[...new Set(c.map(a=>String(a??"").trim()).filter(Boolean))];if(!k.length)return{error:"Pilih minimal satu santri"};let m=k.map(()=>"?").join(","),n=(0,j.getKategoriSantriEfektifSql)("s"),[p,r,s]=await Promise.all([(0,h.query)(`SELECT santri_id FROM kamar_draft WHERE asrama = ? AND santri_id IN (${m})`,[e.asrama,...k]),(0,h.query)(`SELECT s.id, s.kamar, ${n} AS kategori_efektif
       FROM santri s
       WHERE s.status_global = 'aktif' AND s.asrama = ? AND s.id IN (${m})`,[e.asrama,...k]),(0,h.query)(`
      SELECT ${n} AS kategori_efektif, COUNT(*) AS total
      FROM kamar_draft kd
      JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
      WHERE kd.asrama = ? AND kd.kamar_baru = ?
      GROUP BY kategori_efektif
    `,[e.asrama,f])]);if(p.length)return{error:`${p.length} santri sudah ditempatkan di kamar lain`};if(r.length!==k.length)return{error:"Ada santri yang tidak aktif atau bukan penghuni asrama ini"};let t=Math.max(0,Number(i.kuota)-Number(i.reserved_baru??0)),u=Math.max(0,Number(i.reserved_baru??0)),v=Number(s.find(a=>"BARU"===a.kategori_efektif)?.total??0),w=s.reduce((a,b)=>"BARU"===b.kategori_efektif?a:a+Number(b.total??0),0),x=r.filter(a=>"BARU"===a.kategori_efektif).length,y=r.length-x;if(v+x>u)return{error:`Kuota santri baru kamar ${f} tidak cukup`};if(w+y>t)return{error:`Kuota santri lama kamar ${f} tidak cukup`};let z=new Map(r.map(a=>[a.id,a])),A=await (0,h.getDB)();return await A.batch(k.map(a=>A.prepare(`
      INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
      VALUES (?, ?, ?, ?, 0)
    `).bind(e.asrama,a,z.get(a)?.kamar??null,f))),await (0,g.logActivity)({actor:(0,g.actorFromSession)(e.session),module:"plotting_kamar_manual",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_draft",entityId:`${e.asrama}:${f}`,entityLabel:`${e.asrama} kamar ${f}`,summary:`Menambahkan ${k.length} santri ke draft kamar ${f}`,details:{asrama:e.asrama,nomor_kamar:f,total:k.length}}),(0,d.revalidatePath)(l),{success:!0,total:k.length}}async function w(a,b){let c=await o(a);if("error"in c)return c;let e=String(b??"").trim();return e?(await (0,h.execute)("DELETE FROM kamar_draft WHERE asrama = ? AND santri_id = ?",[c.asrama,e]),await (0,h.execute)("DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ?",[c.asrama,e]),await (0,g.logActivity)({actor:(0,g.actorFromSession)(c.session),module:"plotting_kamar_manual",action:"delete",fiturHref:l,logKind:"delete",entityType:"kamar_draft",entityId:e,entityLabel:e,summary:"Menghapus santri dari draft plotting kamar",details:{asrama:c.asrama,santri_id:e}}),(0,d.revalidatePath)(l),{success:!0}):{error:"Santri wajib dipilih"}}async function x(a,b,c){let e=await o(a);if("error"in e)return e;let f=String(b??"").trim();if(!f)return{error:"Kamar wajib dipilih"};if(!await q(e.asrama,f))return{error:"Kamar tidak ada di konfigurasi"};if(c){if(!await (0,h.queryOne)("SELECT santri_id FROM kamar_draft WHERE asrama = ? AND kamar_baru = ? AND santri_id = ?",[e.asrama,f,c]))return{error:"Ketua harus dipilih dari penghuni draft kamar ini"};let a=await (0,h.getDB)();await a.batch([a.prepare("DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?").bind(e.asrama,c,f),a.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(e.asrama,f,c)])}else await (0,h.execute)("DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?",[e.asrama,f]);return await (0,g.logActivity)({actor:(0,g.actorFromSession)(e.session),module:"plotting_kamar_manual",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_ketua",entityId:`${e.asrama}:${f}`,entityLabel:`${e.asrama} kamar ${f}`,summary:c?`Menetapkan ketua kamar ${f}`:`Menghapus ketua kamar ${f}`,details:{asrama:e.asrama,nomor_kamar:f,santri_id:c}}),(0,d.revalidatePath)(l),(0,d.revalidatePath)(m),{success:!0}}async function y(a){let b=await o(a);if("error"in b)return b;let c=(0,j.getKategoriSantriEfektifSql)("s"),e=await (0,h.query)(`
    SELECT kd.*
    FROM kamar_draft kd
    JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
    JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
    WHERE kd.asrama = ?
  `,[b.asrama]);if(!e.length)return{error:"Tidak ada draft untuk diterapkan"};let[f,i]=await Promise.all([(0,h.query)("SELECT nomor_kamar, kuota, reserved_baru FROM kamar_config WHERE asrama = ?",[b.asrama]),(0,h.query)(`
      SELECT kd.kamar_baru, ${c} AS kategori_efektif, COUNT(*) AS total
      FROM kamar_draft kd
      JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
      WHERE kd.asrama = ?
      GROUP BY kd.kamar_baru, kategori_efektif
    `,[b.asrama])]),k=new Map(f.map(a=>[a.nomor_kamar,a]));for(let a of f){let b=i.filter(b=>b.kamar_baru===a.nomor_kamar),c=Number(b.find(a=>"BARU"===a.kategori_efektif)?.total??0),d=b.reduce((a,b)=>"BARU"===b.kategori_efektif?a:a+Number(b.total??0),0),e=Math.max(0,Number(a.reserved_baru??0)),f=Math.max(0,Number(a.kuota??0)-e);if(c>e)return{error:`Kuota santri baru kamar ${a.nomor_kamar} melebihi batas`};if(d>f)return{error:`Kuota santri lama kamar ${a.nomor_kamar} melebihi batas`}}let n=[...new Set(e.map(a=>a.kamar_baru))].filter(a=>!k.has(a));if(n.length)return{error:`Ada draft menuju kamar yang tidak ada di konfigurasi: ${n.join(", ")}`};let p=await (0,h.queryOne)(`
    SELECT COUNT(*) AS total
    FROM santri s
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND s.kamar IS NOT NULL
      AND TRIM(s.kamar) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM kamar_draft kd
        JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
        WHERE kd.asrama = s.asrama AND kd.santri_id = s.id
      )
  `,[b.asrama]),q=await (0,h.getDB)(),s=e.map(a=>q.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ? AND status_global = ? AND asrama = ?").bind(a.kamar_baru,a.santri_id,"aktif",b.asrama));for(let a=0;a<s.length;a+=100)await q.batch(s.slice(a,a+100));return await (0,h.execute)(`
    UPDATE santri
    SET kamar = NULL, updated_at = datetime('now')
    WHERE status_global = 'aktif'
      AND asrama = ?
      AND kamar IS NOT NULL
      AND TRIM(kamar) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM kamar_draft kd
        JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
        WHERE kd.asrama = santri.asrama AND kd.santri_id = santri.id
      )
  `,[b.asrama]),await (0,h.execute)("UPDATE kamar_draft SET applied = 1 WHERE asrama = ?",[b.asrama]),await r(b.asrama),await (0,g.logActivity)({actor:(0,g.actorFromSession)(b.session),module:"plotting_kamar_manual",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_draft",entityId:b.asrama,entityLabel:b.asrama,summary:`Menerapkan plotting manual kamar asrama ${b.asrama}`,details:{total:e.length,dikosongkan:Number(p?.total??0)}}),(0,d.revalidatePath)(l),(0,d.revalidatePath)(m),(0,d.revalidatePath)("/dashboard/asrama/perpindahan-kamar"),{success:!0,count:e.length,clearedCount:Number(p?.total??0)}}(0,k.ensureServerEntryExports)([s,t,u,v,w,x,y]),(0,c.registerServerReference)(s,"402ff277ef1d0b8d1bd0339d5c67f23bacf1a47ba3",null),(0,c.registerServerReference)(t,"602f816f25767f7e36a5684aaf94b5d2c2550506cd",null),(0,c.registerServerReference)(u,"6000ade365319e8de5dffb0f6197bcb351dfa5c26f",null),(0,c.registerServerReference)(v,"709c756c913ec2d8a4aa8e061130a600d5c2af76de",null),(0,c.registerServerReference)(w,"60e08f7f288fecab9098949aa96a26a827cd878b0e",null),(0,c.registerServerReference)(x,"707f5e42417d9fbfcb4182eff439d9237f19b8dd51",null),(0,c.registerServerReference)(y,"409fd317b72806e5841aa907e539deb90dd17f81b2",null),a.s([],85097),a.i(85097),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"402ff277ef1d0b8d1bd0339d5c67f23bacf1a47ba3",()=>s,"409fd317b72806e5841aa907e539deb90dd17f81b2",()=>y,"6000ade365319e8de5dffb0f6197bcb351dfa5c26f",()=>u,"602f816f25767f7e36a5684aaf94b5d2c2550506cd",()=>t,"60e08f7f288fecab9098949aa96a26a827cd878b0e",()=>w,"707f5e42417d9fbfcb4182eff439d9237f19b8dd51",()=>x,"709c756c913ec2d8a4aa8e061130a600d5c2af76de",()=>v],56435)}];

//# sourceMappingURL=ce889_server_app_dashboard_asrama_plotting-kamar-manual_page_actions_676e0b91.js.map