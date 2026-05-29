module.exports=[66332,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(6846),f=a.i(18558),g=a.i(17573),h=a.i(13095);let i=null;async function j(){i??=k().catch(a=>{throw i=null,a}),await i}async function k(){await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_rab_item (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      kategori       TEXT NOT NULL,
      nama_barang    TEXT NOT NULL,
      qty            REAL NOT NULL DEFAULT 0,
      harga          INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      is_system      INTEGER NOT NULL DEFAULT 0,
      system_key     TEXT,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_rab_item_event
    ON ehb_rab_item(ehb_event_id, kategori, urutan)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_keuangan_transaksi (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      tipe           TEXT NOT NULL,
      tanggal        TEXT NOT NULL,
      kategori       TEXT NOT NULL,
      uraian         TEXT NOT NULL,
      qty            REAL NOT NULL DEFAULT 1,
      harga          INTEGER NOT NULL DEFAULT 0,
      nominal        INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      rab_item_id    INTEGER REFERENCES ehb_rab_item(id) ON DELETE SET NULL,
      is_system      INTEGER NOT NULL DEFAULT 0,
      system_key     TEXT,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_keuangan_transaksi_event
    ON ehb_keuangan_transaksi(ehb_event_id, tanggal, tipe, urutan)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_keuangan_signer (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      role           TEXT NOT NULL,
      nama           TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, role)
    )
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_honor_mapel_config (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      marhalah_id    INTEGER REFERENCES marhalah(id),
      waktu          TEXT NOT NULL,
      jumlah_mapel   INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, marhalah_id, waktu)
    )
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_honor_manual (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      jenis          TEXT NOT NULL,
      guru_id        INTEGER REFERENCES data_guru(id),
      nama           TEXT NOT NULL,
      mapel_id       INTEGER REFERENCES mapel(id),
      mapel_nama     TEXT,
      qty            REAL NOT NULL DEFAULT 0,
      keterangan     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_honor_manual_event
    ON ehb_honor_manual(ehb_event_id, jenis, nama)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, mapel_id)
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_event
    ON ehb_pembuat_soal(ehb_event_id, guru_id)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal_marhalah (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      marhalah_id    INTEGER NOT NULL REFERENCES marhalah(id),
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, marhalah_id, mapel_id)
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_marhalah_event
    ON ehb_pembuat_soal_marhalah(ehb_event_id, marhalah_id, guru_id)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal_scope (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      scope_type     TEXT NOT NULL,
      scope_id       TEXT NOT NULL,
      scope_nama     TEXT NOT NULL,
      marhalah_id    INTEGER REFERENCES marhalah(id),
      kelas_id       TEXT REFERENCES kelas(id),
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, scope_type, scope_id, mapel_id)
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_scope_event
    ON ehb_pembuat_soal_scope(ehb_event_id, scope_type, guru_id)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_absensi_pengawas (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id        INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      jadwal_pengawas_id  INTEGER NOT NULL REFERENCES ehb_jadwal_pengawas(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'TIDAK_HADIR',
      badal_source        TEXT,
      badal_pengawas_id   INTEGER REFERENCES ehb_pengawas(id),
      badal_panitia_id    INTEGER REFERENCES ehb_panitia(id),
      badal_nama          TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT,
      UNIQUE(ehb_event_id, jadwal_pengawas_id)
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_absensi_pengawas_event
    ON ehb_absensi_pengawas(ehb_event_id, status)
  `),await (0,c.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_honor_panitia (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      panitia_id     INTEGER NOT NULL REFERENCES ehb_panitia(id) ON DELETE CASCADE,
      nominal        INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, panitia_id)
    )
  `),await (0,c.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_honor_panitia_event
    ON ehb_honor_panitia(ehb_event_id, panitia_id)
  `);try{await (0,c.execute)("ALTER TABLE ehb_honor_manual ADD COLUMN mapel_id INTEGER REFERENCES mapel(id)")}catch{}try{await (0,c.execute)("ALTER TABLE ehb_honor_manual ADD COLUMN mapel_nama TEXT")}catch{}await (0,c.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('EHB', 'Keuangan', '/dashboard/ehb/keuangan', 'Wallet', '["admin"]', 1, 12)
  `)}async function l(){return await j(),(0,c.queryOne)(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1
    LIMIT 1
  `)}async function m(a){return await j(),(0,c.query)(`
    SELECT id, ehb_event_id, kategori, nama_barang, qty, harga, keterangan, is_system, system_key, urutan
    FROM ehb_rab_item
    WHERE ehb_event_id = ?
    ORDER BY
      CASE kategori
        WHEN 'atk_administrasi' THEN 0
        WHEN 'konsumsi' THEN 1
        ELSE 2
      END,
      urutan,
      id
  `,[a])}async function n(a){await j();let b=await (0,c.queryOne)(`
    SELECT nama
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = 'ketua'
    LIMIT 1
  `,[a]);return b?.nama||""}async function o(a){await j();let[b,d]=await Promise.all([(0,c.query)(`
    SELECT jabatan_key, nama
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key IN ('ketua', 'bendahara')
    `,[a]),(0,c.query)(`
      SELECT role, nama
      FROM ehb_keuangan_signer
      WHERE ehb_event_id = ?
    `,[a])]),e=new Map(d.map(a=>[a.role,a.nama])),f=b.find(a=>"ketua"===a.jabatan_key)?.nama||"",g=b.find(a=>"bendahara"===a.jabatan_key)?.nama||"";return{ketua:e.get("ketua")||f,bendahara:e.get("bendahara")||g,wakil_akademik:e.get("wakil_akademik")||"",wakil_keuangan:e.get("wakil_keuangan")||""}}async function p(a){await j();let[b,d,e,f,g,h]=await Promise.all([(0,c.query)(`
      SELECT
        m.id as marhalah_id,
        COALESCE(m.nama, 'Tanpa Marhalah') as marhalah_nama,
        COUNT(DISTINCT ps.santri_id) as jumlah_santri,
        COUNT(DISTINCT j.mapel_id) as jumlah_mapel,
        COUNT(*) as jumlah_hasil
      FROM ehb_plotting_santri ps
      JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
      JOIN kelas k ON k.id = rp.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      JOIN ehb_jadwal j ON j.ehb_event_id = ps.ehb_event_id AND j.kelas_id = k.id
      WHERE ps.ehb_event_id = ?
      GROUP BY m.id, m.nama, m.urutan
      ORDER BY m.urutan
    `,[a]),(0,c.queryOne)(`
      SELECT COUNT(DISTINCT ps.santri_id) as total
      FROM ehb_plotting_santri ps
      JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
      JOIN kelas k ON k.id = rp.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE ps.ehb_event_id = ? AND m.nama NOT LIKE '%Mutawassithah%'
    `,[a]),(0,c.queryOne)(`
      SELECT COUNT(*) as total
      FROM (
        SELECT DISTINCT tanggal, sesi_id
        FROM ehb_jadwal
        WHERE ehb_event_id = ?
      )
    `,[a]),(0,c.queryOne)(`
      SELECT COUNT(*) as total
      FROM ehb_panitia
      WHERE ehb_event_id = ?
    `,[a]),(0,c.queryOne)(`
      SELECT COUNT(*) as total
      FROM ehb_pengawas
      WHERE ehb_event_id = ?
    `,[a]),(0,c.queryOne)(`
      SELECT COUNT(*) as total
      FROM (
        SELECT DISTINCT
          CASE WHEN m.nama LIKE '%Mutawassithah%' THEN 'kelas' ELSE 'marhalah' END as scope_type,
          CASE WHEN m.nama LIKE '%Mutawassithah%' THEN k.id ELSE CAST(m.id AS TEXT) END as scope_id,
          j.mapel_id
        FROM ehb_jadwal j
        JOIN kelas k ON k.id = j.kelas_id
        JOIN marhalah m ON m.id = k.marhalah_id
        WHERE j.ehb_event_id = ?
      )
    `,[a])]),i=b.reduce((a,b)=>a+Number(b.jumlah_hasil||0),0);return{totalHasilUjian:i,rekomendasiRim:Math.max(1,Math.ceil(i/500)),pembuatanSoal:Number(h?.total||0),pemeriksaan:b.map(a=>({...a,jumlah_santri:Number(a.jumlah_santri||0),jumlah_mapel:Number(a.jumlah_mapel||0),jumlah_hasil:Number(a.jumlah_hasil||0)})),raporSantri:Number(d?.total||0),totalSesiEhb:Number(e?.total||0),jumlahPanitia:Number(f?.total||0),jumlahPengawas:Number(g?.total||0)}}async function q(a,b){let d=[["ketua",b.ketua],["bendahara",b.bendahara],["wakil_akademik",b.wakil_akademik],["wakil_keuangan",b.wakil_keuangan]].map(([a,b])=>({role:a,nama:b?.trim()||""}));await (0,c.batch)(d.map(b=>({sql:`
      INSERT INTO ehb_keuangan_signer (ehb_event_id, role, nama, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(ehb_event_id, role) DO UPDATE SET
        nama = excluded.nama,
        updated_at = datetime('now')
    `,params:[a,b.role,b.nama]})))}async function r(a,b,g){let h=await (0,d.getSession)();if(!h)return{error:"Unauthorized"};await j();let i=b.map((a,b)=>({...a,nama_barang:a.nama_barang.trim(),qty:Number.isFinite(Number(a.qty))?Number(a.qty):0,harga:Math.max(0,Math.round(Number(a.harga)||0)),keterangan:a.keterangan?.trim()||null,is_system:+!!a.is_system,urutan:a.urutan??b+1})).filter(a=>a.nama_barang);return await (0,c.execute)("DELETE FROM ehb_rab_item WHERE ehb_event_id = ?",[a]),i.length>0&&await (0,c.batch)(i.map(b=>({sql:`
        INSERT INTO ehb_rab_item
          (ehb_event_id, kategori, nama_barang, qty, harga, keterangan, is_system, system_key, urutan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,params:[a,b.kategori,b.nama_barang,b.qty,b.harga,b.keterangan,b.is_system,b.system_key??null,b.urutan]}))),g&&await q(a,g),(0,f.revalidatePath)("/dashboard/ehb/keuangan"),await (0,e.logActivity)({actor:(0,e.actorFromSession)(h),module:"ehb_keuangan",action:"update",fiturHref:"/dashboard/ehb/keuangan",logKind:"update",entityType:"ehb_rab_batch",entityId:String(a),entityLabel:"RAB EHB",summary:`Menyimpan ${i.length} item RAB EHB`,details:{event_id:a,total_items:i.length}}),{success:!0,saved:i.length}}async function s(a){return await j(),(0,c.query)(`
    SELECT
      id, ehb_event_id, tipe, tanggal, kategori, uraian, qty, harga, nominal,
      keterangan, rab_item_id, is_system, system_key, urutan
    FROM ehb_keuangan_transaksi
    WHERE ehb_event_id = ?
    ORDER BY tanggal, CASE tipe WHEN 'pemasukan' THEN 0 ELSE 1 END, urutan, id
  `,[a])}async function t(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};await j();let h=b.map((a,b)=>{let c=Number.isFinite(Number(a.qty))?Number(a.qty):1,d=Math.max(0,Math.round(Number(a.harga)||0)),e=Math.max(0,Math.round(Number(a.nominal)||c*d||0));return{...a,tanggal:a.tanggal||"",kategori:a.kategori.trim(),uraian:a.uraian.trim(),qty:c,harga:d,nominal:e,keterangan:a.keterangan?.trim()||null,is_system:+!!a.is_system,urutan:a.urutan??b+1}}).filter(a=>a.tanggal&&a.kategori&&a.uraian);return await (0,c.execute)("DELETE FROM ehb_keuangan_transaksi WHERE ehb_event_id = ?",[a]),h.length>0&&await (0,c.batch)(h.map(b=>({sql:`
        INSERT INTO ehb_keuangan_transaksi
          (ehb_event_id, tipe, tanggal, kategori, uraian, qty, harga, nominal, keterangan, rab_item_id, is_system, system_key, urutan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,params:[a,b.tipe,b.tanggal,b.kategori,b.uraian,b.qty,b.harga,b.nominal,b.keterangan,b.rab_item_id??null,b.is_system,b.system_key??null,b.urutan]}))),(0,f.revalidatePath)("/dashboard/ehb/keuangan"),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_keuangan",action:"update",fiturHref:"/dashboard/ehb/keuangan",logKind:"update",entityType:"ehb_transaksi_batch",entityId:String(a),entityLabel:"Transaksi EHB",summary:`Menyimpan ${h.length} transaksi EHB`,details:{event_id:a,total_items:h.length}}),{success:!0,saved:h.length}}let u={"Tamhidiyyah 1":{shubuh:1,ashar:2,maghrib:1},"Tamhidiyyah 2":{shubuh:2,ashar:2,maghrib:0},"Ibtidaiyyah 1":{shubuh:3,ashar:3,maghrib:2},"Ibtidaiyyah 2":{shubuh:3,ashar:3,maghrib:2},"Ibtidaiyyah 3":{shubuh:3,ashar:3,maghrib:2}};async function v(a){await j();let b=await (0,c.query)(`
    SELECT DISTINCT m.id, m.nama
    FROM ehb_kelas_jam kj
    JOIN kelas k ON k.id = kj.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE kj.ehb_event_id = ?
    ORDER BY m.urutan
  `,[a]),d=new Set((await (0,c.query)(`
    SELECT marhalah_id, waktu
    FROM ehb_honor_mapel_config
    WHERE ehb_event_id = ?
  `,[a])).map(a=>`${a.marhalah_id}-${a.waktu}`)),e=[];for(let c of b){let b=u[c.nama.replace(/\s+/g," ").trim()]??{shubuh:0,ashar:0,maghrib:0};for(let f of["shubuh","ashar","maghrib"]){let g=`${c.id}-${f}`;d.has(g)||e.push({sql:`
          INSERT INTO ehb_honor_mapel_config (ehb_event_id, marhalah_id, waktu, jumlah_mapel)
          VALUES (?, ?, ?, ?)
        `,params:[a,c.id,f,b[f]]})}}e.length>0&&await (0,c.batch)(e)}async function w(a){await j();let b=await (0,c.query)(`
    SELECT system_key, harga
    FROM ehb_rab_item
    WHERE ehb_event_id = ? AND kategori = 'honorarium'
  `,[a]),d=(...a)=>Number(b.find(b=>b.system_key&&a.includes(b.system_key))?.harga||0);return{pembuatan_soal:d("honor_pembuatan_soal"),pengisian_rapor:d("honor_pengisian_rapor"),pemeriksaan_hasil:d("honor_pemeriksaan_hasil"),pengawasan:d("honor_pengawasan")}}async function x(a){return await v(a),(0,c.query)(`
    SELECT c.id, c.ehb_event_id, c.marhalah_id, m.nama as marhalah_nama, c.waktu, c.jumlah_mapel
    FROM ehb_honor_mapel_config c
    JOIN marhalah m ON m.id = c.marhalah_id
    WHERE c.ehb_event_id = ?
    ORDER BY m.urutan,
      CASE c.waktu WHEN 'shubuh' THEN 0 WHEN 'ashar' THEN 1 ELSE 2 END
  `,[a])}async function y(a,b){let g=await (0,d.getSession)();return g?(await j(),b.length>0&&await (0,c.batch)(b.map(b=>({sql:`
        INSERT INTO ehb_honor_mapel_config (ehb_event_id, marhalah_id, waktu, jumlah_mapel)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ehb_event_id, marhalah_id, waktu) DO UPDATE SET
          jumlah_mapel = excluded.jumlah_mapel,
          updated_at = datetime('now')
      `,params:[a,b.marhalah_id,b.waktu,Math.max(0,Math.round(Number(b.jumlah_mapel)||0))]}))),(0,f.revalidatePath)("/dashboard/ehb/keuangan"),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_keuangan",action:"update",fiturHref:"/dashboard/ehb/keuangan",logKind:"update",entityType:"ehb_honor_mapel_batch",entityId:String(a),entityLabel:"Honor mapel EHB",summary:`Menyimpan konfigurasi honor mapel (${b.length} baris)`,details:{event_id:a,total_rows:b.length}}),{success:!0,saved:b.length}):{error:"Unauthorized"}}async function z(){return(0,c.query)(`
    SELECT id, nama_lengkap as nama
    FROM data_guru
    ORDER BY nama_lengkap
  `)}async function A(a){return await j(),(0,c.query)(`
    SELECT DISTINCT mp.id, mp.nama
    FROM ehb_jadwal j
    JOIN mapel mp ON mp.id = j.mapel_id
    WHERE j.ehb_event_id = ?
    ORDER BY mp.nama
  `,[a])}async function B(a){await j();let b=await (0,c.query)(`
    SELECT id, guru_id, nama, mapel_id, mapel_nama, qty, keterangan
    FROM ehb_honor_manual
    WHERE ehb_event_id = ? AND jenis = 'pembuatan_soal'
    ORDER BY nama, mapel_nama
  `,[a]);return b.length>0?b:[]}async function C(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};await j();let h=b.map(a=>({guru_id:a.guru_id??null,nama:a.nama.trim(),mapel_id:a.mapel_id??null,mapel_nama:a.mapel_nama?.trim()||null,qty:Number(a.qty||0),keterangan:a.keterangan?.trim()||null})).filter(a=>a.nama&&a.mapel_id&&a.qty>0);return await (0,c.execute)("DELETE FROM ehb_honor_manual WHERE ehb_event_id = ? AND jenis = 'pembuatan_soal'",[a]),h.length>0&&await (0,c.batch)(h.map(b=>({sql:`
        INSERT INTO ehb_honor_manual (ehb_event_id, jenis, guru_id, nama, mapel_id, mapel_nama, qty, keterangan)
        VALUES (?, 'pembuatan_soal', ?, ?, ?, ?, ?, ?)
      `,params:[a,b.guru_id,b.nama,b.mapel_id,b.mapel_nama,b.qty,b.keterangan]}))),(0,f.revalidatePath)("/dashboard/ehb/keuangan"),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_keuangan",action:"update",fiturHref:"/dashboard/ehb/keuangan",logKind:"update",entityType:"ehb_honor_manual_batch",entityId:String(a),entityLabel:"Honor pembuatan soal EHB",summary:`Menyimpan honor pembuatan soal untuk ${h.length} guru`,details:{event_id:a,total_rows:h.length}}),{success:!0,saved:h.length}}async function D(a){await Promise.all([v(a),(0,g.backfillManualWaliKelasFromGuruMaghrib)()]);let[b,d,e,f,h]=await Promise.all([w(a),(0,c.query)(`
      SELECT
        ps.guru_id,
        COALESCE(dg.nama_lengkap, ps.nama_guru, 'Pembuat soal belum diatur') as nama,
        COUNT(*) as qty,
        GROUP_CONCAT(ps.scope_nama || ' - ' || mp.nama, ', ') as detail
      FROM ehb_pembuat_soal_scope ps
      JOIN mapel mp ON mp.id = ps.mapel_id
      LEFT JOIN data_guru dg ON dg.id = ps.guru_id
      WHERE ps.ehb_event_id = ? AND (ps.guru_id IS NOT NULL OR COALESCE(ps.nama_guru, '') <> '')
      GROUP BY ps.guru_id, dg.nama_lengkap, ps.nama_guru
      ORDER BY nama
    `,[a]),(0,c.query)(`
      SELECT
        k.wali_kelas_id as wali_id,
        COALESCE(u.full_name, 'Wali kelas belum diatur') as nama,
        COUNT(rp.santri_id) as qty,
        GROUP_CONCAT(k.nama_kelas, ', ') as detail
      FROM kelas k
      JOIN marhalah m ON m.id = k.marhalah_id
      JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN users u ON u.id = k.wali_kelas_id
      JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
      WHERE m.nama NOT LIKE '%Mutawassithah%'
      GROUP BY k.wali_kelas_id, u.full_name
      ORDER BY u.full_name
    `,[a]),(0,c.query)(`
      SELECT
        dg.id as guru_id,
        dg.nama_lengkap as nama,
        src.waktu,
        k.nama_kelas,
        COUNT(DISTINCT ps.santri_id) as jumlah_santri,
        COALESCE(cfg.jumlah_mapel, 0) as jumlah_mapel
      FROM (
        SELECT id as kelas_id, guru_shubuh_id as guru_id, 'shubuh' as waktu FROM kelas WHERE guru_shubuh_id IS NOT NULL
        UNION ALL
        SELECT id as kelas_id, guru_ashar_id as guru_id, 'ashar' as waktu FROM kelas WHERE guru_ashar_id IS NOT NULL
        UNION ALL
        SELECT id as kelas_id, guru_maghrib_id as guru_id, 'maghrib' as waktu FROM kelas WHERE guru_maghrib_id IS NOT NULL
      ) src
      JOIN kelas k ON k.id = src.kelas_id
      JOIN data_guru dg ON dg.id = src.guru_id
      JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
      JOIN ehb_plotting_santri ps ON ps.ehb_event_id = kj.ehb_event_id AND ps.santri_id IN (
        SELECT rp.santri_id FROM riwayat_pendidikan rp WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
      )
      LEFT JOIN ehb_honor_mapel_config cfg
        ON cfg.ehb_event_id = kj.ehb_event_id AND cfg.marhalah_id = k.marhalah_id AND cfg.waktu = src.waktu
      GROUP BY dg.id, dg.nama_lengkap, src.waktu, k.id, k.nama_kelas, cfg.jumlah_mapel
      HAVING jumlah_mapel > 0
      ORDER BY dg.nama_lengkap, k.nama_kelas, src.waktu
    `,[a]),(0,c.query)(`
      WITH hadir AS (
        SELECT
          p.id as pengawas_id,
          p.guru_id,
          p.nama_pengawas as nama,
          r.nomor_ruangan || ' / ' || s.label as detail
        FROM ehb_absensi_pengawas ap
        JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
        JOIN ehb_pengawas p ON p.id = jp.pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE ap.ehb_event_id = ? AND ap.status = 'HADIR'
      ),
      badal_pengawas AS (
        SELECT
          bp.id as pengawas_id,
          bp.guru_id,
          bp.nama_pengawas as nama,
          r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
        FROM ehb_absensi_pengawas ap
        JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
        JOIN ehb_pengawas bp ON bp.id = ap.badal_pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source = 'pengawas'
      ),
      badal_panitia AS (
        SELECT
          NULL as pengawas_id,
          ep.guru_id,
          ep.nama as nama,
          r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
        FROM ehb_absensi_pengawas ap
        JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
        JOIN ehb_panitia ep ON ep.id = ap.badal_panitia_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source = 'panitia'
      ),
      badal_sadesa AS (
        SELECT
          NULL as pengawas_id,
          NULL as guru_id,
          ap.badal_nama as nama,
          r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
        FROM ehb_absensi_pengawas ap
        JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
        JOIN ehb_ruangan r ON r.id = jp.ruangan_id
        JOIN ehb_sesi s ON s.id = jp.sesi_id
        WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source IN ('sadesa', 'manual') AND COALESCE(ap.badal_nama, '') <> ''
      ),
      merged AS (
        SELECT * FROM hadir
        UNION ALL SELECT * FROM badal_pengawas
        UNION ALL SELECT * FROM badal_panitia
        UNION ALL SELECT * FROM badal_sadesa
      )
      SELECT
        pengawas_id,
        guru_id,
        nama,
        COUNT(*) as qty,
        GROUP_CONCAT(detail, ', ') as detail
      FROM merged
      GROUP BY COALESCE(CAST(pengawas_id AS TEXT), 'sadesa:' || nama), guru_id, nama
      ORDER BY nama
    `,[a,a,a,a])]),i=d.filter(a=>Number(a.qty||0)>0).map(a=>({id:`soal-${a.guru_id??a.nama}`,jenis:"pembuatan_soal",guru_id:a.guru_id,mapel_id:null,mapel_nama:null,nama:a.nama,qty:Number(a.qty||0),tarif:b.pembuatan_soal,total:Number(a.qty||0)*b.pembuatan_soal,detail:a.detail||"Soal EHB",editable:!1})),j=e.filter(a=>a.wali_id).map(a=>({id:`rapor-${a.wali_id}`,jenis:"pengisian_rapor",guru_id:null,nama:a.nama,qty:Number(a.qty||0),tarif:b.pengisian_rapor,total:Number(a.qty||0)*b.pengisian_rapor,detail:a.detail||"Wali kelas",editable:!1})),k=new Map;for(let a of f){let c=Number(a.jumlah_santri||0)*Number(a.jumlah_mapel||0);k.has(a.guru_id)||k.set(a.guru_id,{id:`periksa-${a.guru_id}`,jenis:"pemeriksaan_hasil",guru_id:a.guru_id,nama:a.nama,qty:0,tarif:b.pemeriksaan_hasil,total:0,detail:"",editable:!1,details:[]});let d=k.get(a.guru_id);d.qty+=c,d.total=d.qty*d.tarif,d.details.push(`${a.nama_kelas} ${a.waktu}: ${a.jumlah_santri} x ${a.jumlah_mapel}`)}return[...i,...j,...Array.from(k.values()).map(({details:a,...b})=>({...b,detail:a.join("; ")})),...h.map(a=>({id:`pengawas-${a.pengawas_id??a.nama}`,jenis:"pengawasan",guru_id:a.guru_id,nama:a.nama,qty:Number(a.qty||0),tarif:b.pengawasan,total:Number(a.qty||0)*b.pengawasan,detail:a.detail||"Jadwal pengawasan",editable:!1}))]}async function E(a){await j();let[b,d]=await Promise.all([(0,c.queryOne)(`
      SELECT harga as budget
      FROM ehb_rab_item
      WHERE ehb_event_id = ? AND kategori = 'honorarium' AND system_key = 'honor_panitia'
      ORDER BY id
      LIMIT 1
    `,[a]),(0,c.query)(`
      SELECT
        p.id as panitia_id,
        p.tipe,
        p.jabatan_key,
        p.seksi_key,
        p.peran,
        p.nama,
        COALESCE(hp.nominal, 0) as nominal,
        hp.keterangan,
        p.urutan
      FROM ehb_panitia p
      LEFT JOIN ehb_honor_panitia hp
        ON hp.panitia_id = p.id AND hp.ehb_event_id = p.ehb_event_id
      WHERE p.ehb_event_id = ?
      ORDER BY
        CASE p.tipe WHEN 'inti' THEN 0 ELSE 1 END,
        p.urutan,
        p.seksi_key,
        CASE p.peran WHEN 'ketua' THEN 0 ELSE 1 END,
        p.nama
    `,[a])]);return{budget:Number(b?.budget||0),rows:d.map(a=>({...a,nominal:Number(a.nominal||0)}))}}async function F(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};await j();let h=b.map(a=>({panitia_id:Number(a.panitia_id),nominal:Math.max(0,Math.round(Number(a.nominal)||0)),keterangan:a.keterangan?.trim()||null})).filter(a=>a.panitia_id);return h.length>0&&await (0,c.batch)(h.map(b=>({sql:`
        INSERT INTO ehb_honor_panitia (ehb_event_id, panitia_id, nominal, keterangan)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ehb_event_id, panitia_id) DO UPDATE SET
          nominal = excluded.nominal,
          keterangan = excluded.keterangan,
          updated_at = datetime('now')
      `,params:[a,b.panitia_id,b.nominal,b.keterangan]}))),(0,f.revalidatePath)("/dashboard/ehb/keuangan"),(0,f.revalidatePath)("/dashboard/ehb/keuangan/honor-panitia"),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_keuangan",action:"update",fiturHref:"/dashboard/ehb/keuangan",logKind:"update",entityType:"ehb_honor_panitia_batch",entityId:String(a),entityLabel:"Honor panitia EHB",summary:`Menyimpan honor panitia untuk ${h.length} orang`,details:{event_id:a,total_rows:h.length}}),{success:!0,saved:h.length}}(0,h.ensureServerEntryExports)([j,l,m,n,o,p,r,s,t,v,w,x,y,z,A,B,C,D,E,F]),(0,b.registerServerReference)(j,"00af456214de436c658ee93dff495c7f5a064e4ba7",null),(0,b.registerServerReference)(l,"00c760672cf8460368f5c22c4ff6565a15db8f857d",null),(0,b.registerServerReference)(m,"40ba3005bbcdd94ca405aafe3fb30b14dadc25acc0",null),(0,b.registerServerReference)(n,"4024c569737f23a0b92411813a825401ec1a217073",null),(0,b.registerServerReference)(o,"405164079b93abd2bff75cde3c99f9fedf8645a3b1",null),(0,b.registerServerReference)(p,"400b6724087d474e0ad422f678e8d4500c5b362b12",null),(0,b.registerServerReference)(r,"70dc832b0d000e096a3255a4909055948254019154",null),(0,b.registerServerReference)(s,"405727327d1090b351ca4df31661fa18cbb2c9634e",null),(0,b.registerServerReference)(t,"6028085fcc88a7a6533237194dcff3923d177b9989",null),(0,b.registerServerReference)(v,"406b02761c67703190c88adc8624cb0375f3ae9062",null),(0,b.registerServerReference)(w,"4059370bd7f1ff1d458bdec907c75179331cc8ea1a",null),(0,b.registerServerReference)(x,"40860f6452c44924af2644a15ad54d8230d45ebfbc",null),(0,b.registerServerReference)(y,"60a2937422fe729d4d7014dc7bdaf6acb594c7e085",null),(0,b.registerServerReference)(z,"0077b1aedc49591012a957749518e7358b5e2f85c6",null),(0,b.registerServerReference)(A,"40be2c50c2bf3ce9411fcd5715f4e448b2f668478e",null),(0,b.registerServerReference)(B,"400a6913a3bfe73a0a44c5702ea199a84dfc610a49",null),(0,b.registerServerReference)(C,"60236201c06fe8c04053130636515611a0246b4ffa",null),(0,b.registerServerReference)(D,"403eef2266cefc8b19bd0133f634baf0597aa3d249",null),(0,b.registerServerReference)(E,"4052c2ebe1f82305128bed9d2245cd5370af1b90c3",null),(0,b.registerServerReference)(F,"60680c76ceba2f234eb65c7879f06575f595541dcd",null),a.s(["getActiveEventForKeuangan",()=>l,"getHonorItems",()=>D,"getHonorMapelConfig",()=>x,"getHonorPanitiaData",()=>E,"getHonorTarif",()=>w,"getKeuanganSigners",()=>o,"getRabAutoBasis",()=>p,"getRabItems",()=>m,"getTransaksiItems",()=>s,"saveHonorMapelConfig",()=>y,"saveHonorPanitiaBatch",()=>F,"saveRabItems",()=>r,"saveTransaksiItems",()=>t])}];

//# sourceMappingURL=app_dashboard_ehb_keuangan_actions_ts_6d4e2981._.js.map