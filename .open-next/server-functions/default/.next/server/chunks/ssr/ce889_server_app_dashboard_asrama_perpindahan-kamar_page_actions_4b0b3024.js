module.exports=[44664,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(4552),g=a.i(53457),h=a.i(6846),i=a.i(18558),j=a.i(13095);let k="/dashboard/asrama/perpindahan-kamar";async function l(a){let b=await (0,f.assertFeature)("/dashboard/asrama/perpindahan-kamar"),c=a?.trim();if("error"in b)return b;if(!c)return{error:"Asrama wajib dipilih"};if((0,g.isAsramaTanpaKamar)(c))return{error:"Asrama ini tidak memakai fitur kamar"};if(!(0,e.isAdmin)(b)){if(!(0,e.hasRole)(b,"pengurus_asrama"))return{error:"Unauthorized"};if(!b.asrama_binaan)return{error:"Asrama binaan akun belum diset"};if(b.asrama_binaan!==c)return{error:"Anda hanya boleh mengelola asrama binaan Anda"}}return{session:b,asrama:c}}async function m(a,b){return(0,d.queryOne)("SELECT nomor_kamar FROM kamar_config WHERE asrama = ? AND nomor_kamar = ?",[a,b])}async function n(){let a=await (0,d.getDB)();await a.batch([a.prepare(`
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
    `)]);let b=await (0,d.query)("PRAGMA table_info(kamar_config)");b.some(a=>"blok"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN blok TEXT"),b.some(a=>"reserved_baru"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0")}async function o(a){await n();let b=await l(a);if("error"in b)return{error:b.error,configs:[],drafts:[],ketuaList:[],santriList:[],defaultConfigs:[]};let c=b.asrama,[e,f,g,h,i]=await Promise.all([(0,d.query)("SELECT * FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar",[c]),(0,d.query)("SELECT * FROM kamar_draft WHERE asrama = ?",[c]),(0,d.query)(`
      SELECT kk.*, s.nama_lengkap, s.nis
      FROM kamar_ketua kk
      JOIN santri s ON s.id = kk.santri_id
       AND s.status_global = 'aktif'
       AND s.asrama = kk.asrama
      JOIN kamar_config kc
        ON kc.asrama = kk.asrama
       AND kc.nomor_kamar = kk.nomor_kamar
      WHERE kk.asrama = ?
    `,[c]),(0,d.query)(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin,
             s.kamar AS kamar_asli, s.sekolah, s.kelas_sekolah,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' AND s.asrama = ?
      ORDER BY s.kelas_sekolah, s.nama_lengkap
    `,[c]),(0,d.query)(`
      SELECT TRIM(s.kamar) AS nomor_kamar, COUNT(*) AS kuota
      FROM santri s
      WHERE s.status_global = 'aktif'
        AND s.asrama = ?
        AND s.kamar IS NOT NULL
        AND TRIM(s.kamar) <> ''
      GROUP BY TRIM(s.kamar)
      ORDER BY CAST(TRIM(s.kamar) AS INTEGER), TRIM(s.kamar)
    `,[c])]),j=e.length?e:i.map(a=>({nomor_kamar:a.nomor_kamar,kuota:Number(a.kuota)||1,reserved_baru:0,blok:""}));return{configs:e,drafts:f,ketuaList:g,santriList:h,defaultConfigs:j}}async function p(a,b){await n();let c=await l(a);if("error"in c)return c;let e=function(a){if(!a.length)return{error:"Tambahkan minimal 1 kamar"};let b=new Set,c=a.map(a=>({nomor_kamar:String(a.nomor_kamar??"").trim(),kuota:Number(a.kuota),reserved_baru:Number(a.reserved_baru??0),blok:a.blok?String(a.blok).trim().toUpperCase():""}));for(let a of c){if(!a.nomor_kamar)return{error:"Nomor kamar tidak boleh kosong"};if(b.has(a.nomor_kamar))return{error:`Nomor kamar ${a.nomor_kamar} duplikat`};if(b.add(a.nomor_kamar),!Number.isInteger(a.kuota)||a.kuota<1||a.kuota>50)return{error:`Kuota kamar ${a.nomor_kamar} harus 1-50`};if(!Number.isInteger(a.reserved_baru)||a.reserved_baru<0||a.reserved_baru>50)return{error:`Slot santri baru kamar ${a.nomor_kamar} harus 0-50`};if(a.reserved_baru>a.kuota)return{error:`Slot santri baru kamar ${a.nomor_kamar} melebihi kuota. Naikkan kuota dulu.`}}return c}(b);if("error"in e)return e;let f=await (0,d.getDB)();try{let a=e.map(a=>a.nomor_kamar),b=a.map(()=>"?").join(","),d=[f.prepare("DELETE FROM kamar_config WHERE asrama = ?").bind(c.asrama),...e.map(a=>f.prepare("INSERT INTO kamar_config (asrama, nomor_kamar, kuota, reserved_baru, blok) VALUES (?, ?, ?, ?, ?)").bind(c.asrama,a.nomor_kamar,a.kuota,a.reserved_baru,a.blok||null)),f.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND kamar_baru NOT IN (${b})`).bind(c.asrama,...a),f.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND santri_id NOT IN (
        SELECT id FROM santri WHERE status_global = 'aktif' AND asrama = ?
      )`).bind(c.asrama,c.asrama),f.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar NOT IN (${b})`).bind(c.asrama,...a),f.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id NOT IN (
        SELECT id FROM santri WHERE status_global = 'aktif' AND asrama = ?
      )`).bind(c.asrama,c.asrama)];return await f.batch(d),await (0,h.logActivity)({actor:(0,h.actorFromSession)(c.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_config_batch",entityId:c.asrama,entityLabel:c.asrama,summary:`Memperbarui konfigurasi kamar asrama ${c.asrama}`,details:{total_kamar:e.length}}),(0,i.revalidatePath)(k),{success:!0}}catch(a){return{error:a.message}}}async function q(a){await n();let b=await l(a);if("error"in b)return b;let{configs:c,santriList:e}=await o(b.asrama);if(!c.length)return{error:"Belum ada konfigurasi kamar"};if(!e.length)return{error:"Tidak ada santri di asrama ini"};let f=await (0,d.getDB)(),g=await (0,d.query)(`
    SELECT kk.santri_id, kk.nomor_kamar
    FROM kamar_ketua kk
    JOIN santri s
      ON s.id = kk.santri_id
     AND s.status_global = 'aktif'
     AND s.asrama = kk.asrama
    JOIN kamar_config kc
      ON kc.asrama = kk.asrama
     AND kc.nomor_kamar = kk.nomor_kamar
    WHERE kk.asrama = ?
  `,[b.asrama]),j=c.map(a=>{let b=Number(a.kuota),c=Number(a.reserved_baru??0),d=g.filter(b=>b.nomor_kamar===a.nomor_kamar).length;return{nomor:a.nomor_kamar,kuota:b,reserved_baru:c,blok:a.blok||null,efektif:Math.max(0,b-c-d)}}),m=j.reduce((a,b)=>a+b.reserved_baru,0),p=j.reduce((a,b)=>a+b.kuota-b.reserved_baru,0),q={};for(let a of j){let b=a.blok||"__TANPA_BLOK__";q[b]||(q[b]=[]),q[b].push(a)}let r={};for(let a of g)r[a.santri_id]=a.nomor_kamar;let s={},t={};for(let a of j)t[a.nomor]=a.blok||"__TANPA_BLOK__";for(let a of e){if(r[a.id])continue;let b=a.kamar_asli&&t[a.kamar_asli]?t[a.kamar_asli]:"__TANPA_BLOK__";s[b]||(s[b]=[]),s[b].push(a)}for(let[a,b]of Object.entries(s))!function(a,b,c){let d=function(a){let b={};for(let c of a){let a=c.kelas_sekolah||"BELUM_SET";b[a]||(b[a]=[]),b[a].push(c)}let c=Object.keys(b).sort(),d=Math.max(...c.map(a=>b[a].length),0),e=[];for(let a=0;a<d;a++)for(let d of c)b[d][a]&&e.push(b[d][a]);return e}(a.filter(a=>!c[a.id])),e=0;for(let a of b)for(let b=0;b<a.efektif&&e<d.length;b++,e++)c[d[e].id]=a.nomor;for(let a=e;a<d.length;a++){let e={};for(let[,a]of Object.entries(c))b.some(b=>b.nomor===a)&&(e[a]=(e[a]||0)+1);let f=b.reduce((a,b)=>(e[a.nomor]||0)<=(e[b.nomor]||0)?a:b);c[d[a].id]=f.nomor}}(b,q[a]||j,r);try{let a=[f.prepare("DELETE FROM kamar_draft WHERE asrama = ?").bind(b.asrama),...e.map(a=>f.prepare(`
          INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
          VALUES (?, ?, ?, ?, 0)
        `).bind(b.asrama,a.id,a.kamar_asli||null,r[a.id]||j[0].nomor))];for(let b=0;b<a.length;b+=100)await f.batch(a.slice(b,b+100));return await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_draft",entityId:b.asrama,entityLabel:b.asrama,summary:`Generate draft perpindahan kamar untuk asrama ${b.asrama}`,details:{total:e.length,overflow_count:Math.max(0,e.length-p),total_reserved:m}}),(0,i.revalidatePath)(k),{success:!0,total:e.length,overflowCount:Math.max(0,e.length-p),totalReserved:m}}catch(a){return{error:a.message}}}async function r(a,b,c){await n();let e=await l(a);if("error"in e)return e;let f=String(c??"").trim();if(!f)return{error:"Kamar tujuan wajib dipilih"};if(!await m(e.asrama,f))return{error:"Kamar tujuan tidak ada di konfigurasi"};let g=await (0,d.queryOne)(`
    SELECT kd.santri_id, kd.kamar_lama
    FROM kamar_draft kd
    JOIN santri s
      ON s.id = kd.santri_id
     AND s.status_global = 'aktif'
     AND s.asrama = kd.asrama
    WHERE kd.asrama = ? AND kd.santri_id = ?
    LIMIT 1
  `,[e.asrama,b]),j=await (0,d.queryOne)("SELECT id, kamar FROM santri WHERE id = ? AND status_global = 'aktif' AND asrama = ?",[b,e.asrama]);if(!j)return{error:"Santri tidak aktif atau bukan penghuni asrama ini"};let o=await (0,d.queryOne)("SELECT nomor_kamar FROM kamar_ketua WHERE asrama = ? AND santri_id = ?",[e.asrama,b]),p=await (0,d.getDB)();await p.batch([g?p.prepare(`
          UPDATE kamar_draft
          SET kamar_baru = ?, applied = 0
          WHERE asrama = ? AND santri_id = ?
        `).bind(f,e.asrama,b):p.prepare(`
          INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
          VALUES (?, ?, ?, ?, 0)
        `).bind(e.asrama,b,j.kamar??null,f),p.prepare(`
      DELETE FROM kamar_ketua
      WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?
    `).bind(e.asrama,b,f)]);let q=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[b]);return await (0,h.logActivity)({actor:(0,h.actorFromSession)(e.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_draft",entityId:b,entityLabel:q?.nama_lengkap||b,summary:`Memindahkan draft kamar ${q?.nama_lengkap||b}`,details:{asrama:e.asrama,kamar_tujuan:f,removed_ketua_kamar:o&&o.nomor_kamar!==f?o.nomor_kamar:null}}),(0,i.revalidatePath)(k),{success:!0,removedKetuaKamar:o&&o.nomor_kamar!==f?o.nomor_kamar:null}}async function s(a){await n();let b=await l(a);if("error"in b)return b;let[c,e]=await Promise.all([(0,d.query)("SELECT id, santri_id FROM kamar_draft WHERE asrama = ?",[b.asrama]),(0,d.query)(`
      SELECT kd.*
      FROM kamar_draft kd
      JOIN santri s
        ON s.id = kd.santri_id
       AND s.status_global = 'aktif'
       AND s.asrama = kd.asrama
      JOIN kamar_config kc
        ON kc.asrama = kd.asrama
       AND kc.nomor_kamar = kd.kamar_baru
      WHERE kd.asrama = ?
    `,[b.asrama])]);if(!c.length)return{error:"Tidak ada draft untuk diapply"};if(!e.length)return{error:"Semua draft sudah tidak valid. Generate ulang draft."};let f=await (0,d.getDB)();try{let a=e.map(a=>a.id),d=e.map(a=>a.santri_id),g=a.map(()=>"?").join(","),j=d.map(()=>"?").join(","),l=c.length-e.length,m=e.map(a=>f.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ? AND status_global = 'aktif' AND asrama = ?").bind(a.kamar_baru,a.santri_id,b.asrama)),n=[f.prepare(`UPDATE kamar_draft SET applied = 1 WHERE asrama = ? AND santri_id IN (${j})`).bind(b.asrama,...d),f.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND id NOT IN (${g})`).bind(b.asrama,...a)];for(let a=0;a<m.length;a+=100)await f.batch(m.slice(a,a+100));return await f.batch(n),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_draft",entityId:b.asrama,entityLabel:b.asrama,summary:`Menerapkan draft perpindahan kamar asrama ${b.asrama}`,details:{applied_count:e.length,skipped:l}}),(0,i.revalidatePath)(k),{success:!0,count:e.length,skipped:l}}catch(a){return{error:a.message}}}async function t(a,b,c){await n();let e=await l(a);if("error"in e)return e;let f=String(b??"").trim();if(!f)return{error:"Nomor kamar wajib diisi"};if(!await m(e.asrama,f))return{error:"Kamar tidak ada di konfigurasi"};if(c){if(!await (0,d.queryOne)("SELECT id FROM santri WHERE id = ? AND status_global = 'aktif' AND asrama = ?",[c,e.asrama]))return{error:"Santri tidak aktif atau bukan penghuni asrama ini"};let a=await (0,d.queryOne)("SELECT kamar_baru FROM kamar_draft WHERE asrama = ? AND santri_id = ?",[e.asrama,c]);if(a&&a.kamar_baru!==f)return{error:"Santri ini tidak ada di draft kamar tujuan"};let b=await (0,d.getDB)();await b.batch([b.prepare("DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?").bind(e.asrama,c,f),b.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(e.asrama,f,c)]);let g=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[c]);await (0,h.logActivity)({actor:(0,h.actorFromSession)(e.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_ketua",entityId:`${e.asrama}:${f}`,entityLabel:`${e.asrama} kamar ${f}`,summary:`Menetapkan ketua kamar ${f}`,details:{asrama:e.asrama,nomor_kamar:f,santri_id:c,nama_santri:g?.nama_lengkap||c}})}else await (0,d.execute)("DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?",[e.asrama,f]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(e.session),module:"asrama_perpindahan_kamar",action:"update",fiturHref:k,logKind:"update",entityType:"kamar_ketua",entityId:`${e.asrama}:${f}`,entityLabel:`${e.asrama} kamar ${f}`,summary:`Menghapus ketua kamar ${f} di asrama ${e.asrama}`,details:{asrama:e.asrama,nomor_kamar:f}});return(0,i.revalidatePath)(k),{success:!0}}async function u(a){await n();let b=await l(a);return"error"in b?b:(await (0,d.execute)("DELETE FROM kamar_draft WHERE asrama = ?",[b.asrama]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_perpindahan_kamar",action:"delete",fiturHref:k,logKind:"delete",entityType:"kamar_draft",entityId:b.asrama,entityLabel:b.asrama,summary:`Mereset draft perpindahan kamar asrama ${b.asrama}`,details:{asrama:b.asrama}}),(0,i.revalidatePath)(k),{success:!0})}(0,j.ensureServerEntryExports)([o,p,q,r,s,t,u]),(0,c.registerServerReference)(o,"409b2390a180832dc6e3165de9cf242e74b7ad8daf",null),(0,c.registerServerReference)(p,"605ebbf2d0081cb48e41053705e4bc79c44e7d98a9",null),(0,c.registerServerReference)(q,"402a335852e7122f33cfd5d561d2401d6c007172e4",null),(0,c.registerServerReference)(r,"70190bd13741b905f431e0e7a2572f6b0e881619bf",null),(0,c.registerServerReference)(s,"40614f0b06a937a5a26b7d1630d6639824fbb86966",null),(0,c.registerServerReference)(t,"704b369639d04575ef0c3dbafe671d90c33bef341c",null),(0,c.registerServerReference)(u,"40c84c4e10f5bcab88164a64a93f2793259a62a16e",null),a.s([],84796),a.i(84796),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"402a335852e7122f33cfd5d561d2401d6c007172e4",()=>q,"40614f0b06a937a5a26b7d1630d6639824fbb86966",()=>s,"409b2390a180832dc6e3165de9cf242e74b7ad8daf",()=>o,"40c84c4e10f5bcab88164a64a93f2793259a62a16e",()=>u,"605ebbf2d0081cb48e41053705e4bc79c44e7d98a9",()=>p,"70190bd13741b905f431e0e7a2572f6b0e881619bf",()=>r,"704b369639d04575ef0c3dbafe671d90c33bef341c",()=>t],44664)}];

//# sourceMappingURL=ce889_server_app_dashboard_asrama_perpindahan-kamar_page_actions_4b0b3024.js.map