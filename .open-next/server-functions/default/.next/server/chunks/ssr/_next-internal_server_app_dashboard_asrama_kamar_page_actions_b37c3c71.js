module.exports=[42778,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(4552),f=a.i(53058),g=a.i(53457),h=a.i(6846),i=a.i(85972),j=a.i(18558),k=a.i(13095);let l="/dashboard/asrama/kamar",m="/dashboard/asrama/perpindahan-kamar";async function n(){let a=await (0,d.getDB)();await a.batch([a.prepare(`
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
    `)]);let b=await (0,d.query)("PRAGMA table_info(kamar_config)");b.some(a=>"blok"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN blok TEXT"),b.some(a=>"reserved_baru"===a.name)||await (0,d.execute)("ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0")}async function o(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS asrama_kepengurusan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      asrama      TEXT NOT NULL,
      jabatan_key TEXT NOT NULL,
      kamar       TEXT,
      guru_id     INTEGER REFERENCES data_guru(id),
      nama        TEXT NOT NULL,
      urutan      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT
    )
  `)}async function p(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS santri_keluar_tandai (
      id                TEXT PRIMARY KEY,
      santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      asrama            TEXT NOT NULL,
      kamar             TEXT,
      tanggal_tandai    TEXT NOT NULL,
      catatan           TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      ditandai_oleh     TEXT REFERENCES users(id),
      diproses_oleh     TEXT REFERENCES users(id),
      diproses_at       TEXT,
      keputusan_catatan TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT
    )
  `)}async function q(a){await n(),await o(),await p();let b=await (0,e.assertFeature)(l);if("error"in b)return b;let c=String(a??"").trim();if(!(0,f.isAdmin)(b)){if(!(0,f.hasRole)(b,"pengurus_asrama"))return{error:"Unauthorized"};if(!b.asrama_binaan)return{error:"Asrama binaan akun belum diset"};if(c&&c!==b.asrama_binaan)return{error:"Anda hanya boleh mengakses asrama binaan Anda"}}return{session:b,requestedAsrama:c}}async function r(a){return(0,f.isAdmin)(a)?(await (0,d.query)(`SELECT DISTINCT asrama
     FROM santri
     WHERE status_global = 'aktif'
       AND asrama IS NOT NULL
       AND TRIM(asrama) <> ''
     ORDER BY asrama`)).map(a=>a.asrama).filter(a=>!(0,g.isAsramaTanpaKamar)(a)):a.asrama_binaan&&!(0,g.isAsramaTanpaKamar)(a.asrama_binaan)?[a.asrama_binaan]:[]}async function s(a){let b=await q(a);if("error"in b)return{error:b.error,asramaOptions:[],currentAsrama:"",rooms:[],demografi:{totalSantri:0,totalKamar:0,ketuaTerisi:0,belumBerkamar:0,topSekolah:[],topKota:[]}};let c=await r(b.session),e=b.requestedAsrama||c[0]||"";if(!e)return{asramaOptions:c,currentAsrama:"",rooms:[],demografi:{totalSantri:0,totalKamar:0,ketuaTerisi:0,belumBerkamar:0,topSekolah:[],topKota:[]}};if((0,g.isAsramaTanpaKamar)(e))return{asramaOptions:c,currentAsrama:e,rooms:[],demografi:{totalSantri:0,totalKamar:0,ketuaTerisi:0,belumBerkamar:0,topSekolah:[],topKota:[]}};let[f,h]=await Promise.all([(0,d.query)(`SELECT kamar.nomor_kamar,
              kc.blok,
              COALESCE(kc.kuota, COUNT(s.id)) AS kuota,
              COALESCE(kc.reserved_baru, 0) AS reserved_baru,
              COUNT(s.id) AS total_anggota,
              kk.santri_id AS ketua_santri_id,
              ks.nama_lengkap AS ketua_nama,
              ak.nama AS pembina_nama
       FROM (
         SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
         UNION
         SELECT TRIM(kamar) AS nomor_kamar
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND kamar IS NOT NULL
           AND TRIM(kamar) <> ''
       ) kamar
       LEFT JOIN kamar_config kc
         ON kc.asrama = ?
        AND kc.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri s
         ON s.asrama = ?
        AND s.status_global = 'aktif'
        AND TRIM(COALESCE(s.kamar, '')) = kamar.nomor_kamar
       LEFT JOIN kamar_ketua kk
         ON kk.asrama = ?
        AND kk.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri ks
         ON ks.id = kk.santri_id
        AND ks.status_global = 'aktif'
        AND ks.asrama = ?
       LEFT JOIN asrama_kepengurusan ak
         ON ak.asrama = ?
        AND ak.jabatan_key = 'pembina_kamar'
        AND ak.kamar = kamar.nomor_kamar
       GROUP BY kamar.nomor_kamar, kc.blok, kc.kuota, kc.reserved_baru, kk.santri_id, ks.nama_lengkap, ak.nama
       ORDER BY CAST(kamar.nomor_kamar AS INTEGER), kamar.nomor_kamar`,[e,e,e,e,e,e,e]),(0,d.query)(`SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.kab_kota,
              k.nama_kelas,
              (
                SELECT sk.id
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_id,
              (
                SELECT sk.tanggal_tandai
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_tanggal,
              (
                SELECT sk.catatan
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_catatan
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.status_global = 'aktif' AND s.asrama = ?`,[e])]),i=[...f.map(a=>a.nomor_kamar)].sort((a,b)=>{let c=Number(a),d=Number(b);return Number.isFinite(c)&&Number.isFinite(d)&&c!==d?c-d:a.localeCompare(b,void 0,{numeric:!0,sensitivity:"base"})}).map(a=>{let b=f.find(b=>b.nomor_kamar===a);return{nomor_kamar:a,blok:b.blok??null,kuota:Number(b.kuota??0),reserved_baru:Number(b.reserved_baru??0),total_anggota:Number(b.total_anggota??0),ketua:b.ketua_santri_id?{nomor_kamar:a,santri_id:b.ketua_santri_id,nama_lengkap:b.ketua_nama||"-"}:null,pembina_nama:b.pembina_nama??null}});return{asramaOptions:c,currentAsrama:e,rooms:i,demografi:function(a,b,c){let d=new Map,e=new Map,f=0;for(let b of a){b.kamar&&b.kamar.trim()||(f+=1);let a=b.sekolah?.trim()||"Belum diisi",c=b.kab_kota?.trim()||"Belum diisi";d.set(a,(d.get(a)??0)+1),e.set(c,(e.get(c)??0)+1)}let g=[...d.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).map(([a,b])=>({label:a,total:b})),h=[...e.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).map(([a,b])=>({label:a,total:b}));return{totalSantri:a.length,totalKamar:b,ketuaTerisi:c,belumBerkamar:f,topSekolah:g,topKota:h}}(h,i.length,i.filter(a=>a.ketua).length)}}async function t(a,b){let c=await q(a);if("error"in c)return{error:c.error,room:null};let e=c.requestedAsrama,f=String(b??"").trim(),h=(0,i.getKategoriSantriEfektifSql)("s");if(!f)return{error:"Kamar wajib dipilih",room:null};if((0,g.isAsramaTanpaKamar)(e))return{error:"Asrama ini tidak memakai kamar",room:null};let[j,k]=await Promise.all([(0,d.queryOne)(`SELECT kamar.nomor_kamar,
              kc.blok,
              COALESCE(kc.kuota, kamar.total_anggota) AS kuota,
              COALESCE(kc.reserved_baru, 0) AS reserved_baru,
              kamar.total_anggota,
              kk.santri_id AS ketua_santri_id,
              ks.nama_lengkap AS ketua_nama,
              ak.nama AS pembina_nama
       FROM (
         SELECT ? AS nomor_kamar,
                COUNT(*) AS total_anggota
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND TRIM(COALESCE(kamar, '')) = ?
       ) kamar
       LEFT JOIN kamar_config kc
         ON kc.asrama = ?
        AND kc.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN kamar_ketua kk
         ON kk.asrama = ?
        AND kk.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri ks
         ON ks.id = kk.santri_id
        AND ks.status_global = 'aktif'
        AND ks.asrama = ?
       LEFT JOIN asrama_kepengurusan ak
         ON ak.asrama = ?
        AND ak.jabatan_key = 'pembina_kamar'
        AND ak.kamar = kamar.nomor_kamar`,[f,e,f,e,e,e,e]),(0,d.query)(`SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.kab_kota,
              COALESCE(NULLIF(s.kategori_santri, ''), 'REGULER') AS kategori_santri,
              ${h} AS kategori_efektif,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.status_global = 'aktif'
         AND s.asrama = ?
         AND TRIM(COALESCE(s.kamar, '')) = ?
       ORDER BY s.nama_lengkap`,[e,f])]);return j&&(Number(j.total_anggota)>0||j.kuota||j.pembina_nama||j.ketua_santri_id)?{room:{nomor_kamar:f,blok:j?.blok??null,kuota:Number(j?.kuota??0),reserved_baru:Number(j?.reserved_baru??0),total_anggota:Number(j?.total_anggota??0),ketua:j?.ketua_santri_id?{nomor_kamar:f,santri_id:j.ketua_santri_id,nama_lengkap:j.ketua_nama||"-"}:null,pembina_nama:j?.pembina_nama??null,members:k.map(a=>({...a,alamat_ringkas:a.kab_kota?.trim()||"-",pending_keluar:a.pending_keluar_id?{id:a.pending_keluar_id,tanggal_tandai:a.pending_keluar_tanggal,catatan:a.pending_keluar_catatan}:null}))}}:{error:"Kamar tidak ditemukan",room:null}}async function u(a){let b=await q(a.asrama);if("error"in b)return b;let c=b.requestedAsrama;if((0,g.isAsramaTanpaKamar)(c))return{error:"Asrama ini tidak memakai fitur kamar"};let e=String(a.nomorKamar??"").trim();if(!e)return{error:"Nomor kamar wajib diisi"};if(!await (0,d.queryOne)(`SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif' AND asrama = ? AND kamar IS NOT NULL AND TRIM(kamar) <> ''
     ) kamar
     WHERE nomor_kamar = ?
     LIMIT 1`,[c,c,e]))return{error:"Kamar tidak ditemukan pada asrama ini"};if(a.santriId){if(!await (0,d.queryOne)(`SELECT id
       FROM santri
       WHERE id = ? AND status_global = 'aktif' AND asrama = ? AND kamar = ?`,[a.santriId,c,e]))return{error:"Santri bukan penghuni aktif kamar ini"};let f=await (0,d.getDB)();await f.batch([f.prepare("DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?").bind(c,a.santriId,e),f.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(c,e,a.santriId)]);let g=await (0,d.queryOne)("SELECT nama_lengkap FROM santri WHERE id = ?",[a.santriId]);await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_kamar",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_ketua",entityId:`${c}:${e}`,entityLabel:`${c} kamar ${e}`,summary:`Menetapkan ketua kamar ${e}`,details:{asrama:c,nomor_kamar:e,santri_id:a.santriId,nama_santri:g?.nama_lengkap||a.santriId}})}else await (0,d.execute)("DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?",[c,e]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_kamar",action:"update",fiturHref:l,logKind:"update",entityType:"kamar_ketua",entityId:`${c}:${e}`,entityLabel:`${c} kamar ${e}`,summary:`Menghapus ketua kamar ${e}`,details:{asrama:c,nomor_kamar:e}});return(0,j.revalidatePath)(l),(0,j.revalidatePath)(m),{success:!0}}async function v(a){let b=await q(a.asrama);if("error"in b)return b;let c=b.requestedAsrama;if((0,g.isAsramaTanpaKamar)(c))return{error:"Asrama ini tidak memakai fitur kamar"};let e=String(a.kamarTujuan??"").trim();if(!e)return{error:"Kamar tujuan wajib dipilih"};let f=await (0,d.queryOne)(`SELECT id, kamar, nama_lengkap
     FROM santri
     WHERE id = ? AND status_global = 'aktif' AND asrama = ?`,[a.santriId,c]);if(!f)return{error:"Santri tidak ditemukan di asrama ini"};if(!await (0,d.queryOne)(`SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif' AND asrama = ? AND kamar IS NOT NULL AND TRIM(kamar) <> ''
     ) kamar
     WHERE nomor_kamar = ?
     LIMIT 1`,[c,c,e]))return{error:"Kamar tujuan tidak tersedia di asrama ini"};let i=String(f.kamar??"").trim();if(i===e)return{error:"Santri sudah berada di kamar tersebut"};let k=await (0,d.getDB)();return await k.batch([k.prepare("UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ?").bind(e,a.santriId),k.prepare("DELETE FROM kamar_draft WHERE asrama = ? AND santri_id = ?").bind(c,a.santriId),k.prepare("DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?").bind(c,a.santriId,e)]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_kamar",action:"update",fiturHref:l,logKind:"update",entityType:"mutasi_kamar",entityId:a.santriId,entityLabel:f.nama_lengkap,summary:`Memindahkan kamar ${f.nama_lengkap}`,details:{asrama:c,kamar_asal:i||null,kamar_tujuan:e}}),(0,j.revalidatePath)(l),(0,j.revalidatePath)(m),{success:!0,kamarAsal:i||null}}async function w(a){let b=await q(a.asrama);if("error"in b)return b;let c=await (0,f.getSession)();if(!c)return{error:"Tidak terautentikasi"};let e=b.requestedAsrama,g=await (0,d.queryOne)(`SELECT id, nama_lengkap, asrama, kamar, status_global
     FROM santri
     WHERE id = ? AND asrama = ?`,[a.santriId,e]);if(!g)return{error:"Santri tidak ditemukan di asrama ini"};if("aktif"!==g.status_global)return{error:"Santri sudah tidak aktif"};let i=await (0,d.queryOne)(`SELECT id
     FROM santri_keluar_tandai
     WHERE santri_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,[a.santriId]),k=String(a.catatan??"").trim()||null,m=(0,d.now)();return i?await (0,d.execute)(`UPDATE santri_keluar_tandai
       SET asrama = ?,
           kamar = ?,
           tanggal_tandai = ?,
           catatan = ?,
           ditandai_oleh = ?,
           updated_at = ?
       WHERE id = ?`,[e,g.kamar,m,k,c.id,m,i.id]):await (0,d.execute)(`INSERT INTO santri_keluar_tandai (
        id, santri_id, asrama, kamar, tanggal_tandai, catatan, status, ditandai_oleh, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,[(0,d.generateId)(),a.santriId,e,g.kamar,m,k,c.id,m]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(c),module:"asrama_kamar",action:"update",fiturHref:l,logKind:"update",entityType:"santri_keluar_pengajuan",entityId:a.santriId,entityLabel:g.nama_lengkap,summary:`Menandai santri keluar dari kamar: ${g.nama_lengkap}`,details:{asrama:e,kamar:g.kamar,catatan:k,mode:i?"update":"create"}}),(0,j.revalidatePath)(l),(0,j.revalidatePath)("/dashboard/santri/keluar"),{success:!0}}async function x(a){let b=await q(a.asrama);if("error"in b)return b;let c=await (0,d.queryOne)("SELECT nama_lengkap, kamar FROM santri WHERE id = ? AND asrama = ?",[a.santriId,b.requestedAsrama]);return await (0,d.execute)(`UPDATE santri_keluar_tandai
     SET status = 'dibatalkan',
         diproses_at = ?,
         updated_at = ?
     WHERE santri_id = ? AND asrama = ? AND status = 'pending'`,[(0,d.now)(),(0,d.now)(),a.santriId,b.requestedAsrama]),await (0,h.logActivity)({actor:(0,h.actorFromSession)(b.session),module:"asrama_kamar",action:"update",fiturHref:l,logKind:"update",entityType:"santri_keluar_pengajuan",entityId:a.santriId,entityLabel:c?.nama_lengkap||a.santriId,summary:`Membatalkan tanda keluar dari kamar untuk ${c?.nama_lengkap||a.santriId}`,details:{asrama:b.requestedAsrama,kamar:c?.kamar||null}}),(0,j.revalidatePath)(l),(0,j.revalidatePath)("/dashboard/santri/keluar"),{success:!0}}(0,k.ensureServerEntryExports)([s,t,u,v,w,x]),(0,c.registerServerReference)(s,"40c5d221751e676dc8d3818471c51c87e7c4142d3b",null),(0,c.registerServerReference)(t,"60075af872aafa79473cb874826abf5c7257eb1a61",null),(0,c.registerServerReference)(u,"40fe414afd0102885845b727622ae13de66df8eeb7",null),(0,c.registerServerReference)(v,"40a3df67c67449a0df22497a3aeffa6281d6bbabd0",null),(0,c.registerServerReference)(w,"40169b5b0437a0242a69a1053696cb0b6661274001",null),(0,c.registerServerReference)(x,"40572e616508e51cd22c806988987e2cd10d68300a",null),a.s([],43804),a.i(43804),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"40169b5b0437a0242a69a1053696cb0b6661274001",()=>w,"40572e616508e51cd22c806988987e2cd10d68300a",()=>x,"40a3df67c67449a0df22497a3aeffa6281d6bbabd0",()=>v,"40c5d221751e676dc8d3818471c51c87e7c4142d3b",()=>s,"40fe414afd0102885845b727622ae13de66df8eeb7",()=>u,"60075af872aafa79473cb874826abf5c7257eb1a61",()=>t],42778)}];

//# sourceMappingURL=_next-internal_server_app_dashboard_asrama_kamar_page_actions_b37c3c71.js.map