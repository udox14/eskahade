module.exports=[2541,a=>{"use strict";var b=a.i(12259),c=a.i(53058),d=a.i(34712),e=a.i(18558);let f=null;function g(a){return`ASRAMA:${a.trim().toUpperCase()}`}function h(a){let b=Number(a);return Number.isFinite(b)?b:0}function i(a,b=0){let c=Number.parseInt(String(a??b),10);return Number.isFinite(c)?c:b}function j(a){return"PENGELUARAN"===a.tipe?-Number(a.nominal||0):Number(a.nominal||0)}async function k(){f??=l().catch(a=>{throw f=null,a}),await f}async function l(){await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS operasional_unit (
      id            TEXT PRIMARY KEY,
      kind          TEXT NOT NULL,
      code          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      asrama_name   TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT
    )
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS operasional_alokasi_bulanan (
      id            TEXT PRIMARY KEY,
      tahun         INTEGER NOT NULL,
      bulan         INTEGER NOT NULL,
      unit_id       TEXT NOT NULL REFERENCES operasional_unit(id),
      nominal       INTEGER NOT NULL DEFAULT 0,
      catatan       TEXT,
      status        TEXT NOT NULL DEFAULT 'draft',
      created_by    TEXT REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT,
      posted_by     TEXT REFERENCES users(id),
      posted_at     TEXT,
      cancelled_by  TEXT REFERENCES users(id),
      cancelled_at  TEXT,
      UNIQUE(tahun, bulan, unit_id)
    )
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_alokasi_periode
    ON operasional_alokasi_bulanan(tahun, bulan, unit_id, status)
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS operasional_transaksi (
      id                TEXT PRIMARY KEY,
      tanggal           TEXT NOT NULL,
      periode_tahun     INTEGER NOT NULL,
      periode_bulan     INTEGER NOT NULL,
      unit_id           TEXT NOT NULL REFERENCES operasional_unit(id),
      tipe              TEXT NOT NULL,
      sumber_pemasukan  TEXT,
      kategori          TEXT,
      uraian            TEXT NOT NULL,
      qty               REAL NOT NULL DEFAULT 1,
      harga_satuan      INTEGER NOT NULL DEFAULT 0,
      nominal           INTEGER NOT NULL DEFAULT 0,
      partner_name      TEXT,
      catatan           TEXT,
      receipt_url       TEXT,
      alokasi_id        TEXT REFERENCES operasional_alokasi_bulanan(id) ON DELETE SET NULL,
      is_system         INTEGER NOT NULL DEFAULT 0,
      is_deleted        INTEGER NOT NULL DEFAULT 0,
      deleted_by        TEXT REFERENCES users(id),
      deleted_at        TEXT,
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT
    )
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_periode
    ON operasional_transaksi(periode_tahun, periode_bulan, unit_id, tipe, is_deleted)
  `),await (0,b.execute)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_alokasi
    ON operasional_transaksi(alokasi_id, is_deleted)
  `),await (0,b.execute)(`
    CREATE TABLE IF NOT EXISTS operasional_ttd_pref (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id         TEXT NOT NULL,
      report_type     TEXT NOT NULL,
      scope_key       TEXT NOT NULL,
      slot1_label     TEXT NOT NULL DEFAULT '',
      slot1_nama      TEXT NOT NULL DEFAULT '',
      slot1_jabatan   TEXT NOT NULL DEFAULT '',
      slot2_label     TEXT NOT NULL DEFAULT '',
      slot2_nama      TEXT NOT NULL DEFAULT '',
      slot2_jabatan   TEXT NOT NULL DEFAULT '',
      slot3_label     TEXT NOT NULL DEFAULT '',
      slot3_nama      TEXT NOT NULL DEFAULT '',
      slot3_jabatan   TEXT NOT NULL DEFAULT '',
      updated_by      TEXT REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT,
      UNIQUE(unit_id, report_type, scope_key)
    )
  `),await (0,b.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES
      ('Keuangan Santri', 'Kas Operasional Unit', '/dashboard/operasional', 'WalletCards', '["admin","pengurus_asrama","sekpen","keamanan"]', 1, 0),
      ('Keuangan Pusat', 'Operasional Unit', '/dashboard/keuangan/operasional', 'Wallet', '["admin","bendahara"]', 1, 3)
  `),await (0,b.execute)("UPDATE fitur_akses SET group_name = 'Keuangan Santri', roles = '[\"admin\",\"pengurus_asrama\",\"sekpen\",\"keamanan\"]', updated_at = datetime('now') WHERE href = '/dashboard/operasional'"),await (0,b.execute)("UPDATE fitur_akses SET group_name = 'Keuangan Pusat', updated_at = datetime('now') WHERE href = '/dashboard/keuangan/operasional'"),await (0,b.execute)("DELETE FROM fitur_akses WHERE href IN ('/dashboard/operasional/cetak', '/dashboard/keuangan/operasional/cetak')");try{(0,e.revalidateTag)("fitur-akses","everything")}catch{}await m()}async function m(){let a=[{id:"SEKPEN",kind:"SEKPEN",code:"SEKPEN",name:"Sekpen",asrama_name:null},{id:"KEAMANAN",kind:"KEAMANAN",code:"KEAMANAN",name:"Keamanan",asrama_name:null},...(await (0,b.query)(`
    SELECT DISTINCT TRIM(asrama) as asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND TRIM(asrama) <> ''
      AND UPPER(TRIM(asrama)) <> 'AL-BAGHORY'
    ORDER BY TRIM(asrama)
  `)).map(a=>{let b=a.asrama.trim();return{id:g(b),kind:"ASRAMA",code:g(b),name:b,asrama_name:b}})];a.length>0&&await (0,b.batch)(a.map(a=>({sql:`
        INSERT INTO operasional_unit (id, kind, code, name, asrama_name, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          code = excluded.code,
          name = excluded.name,
          asrama_name = excluded.asrama_name,
          is_active = 1,
          updated_at = excluded.updated_at
      `,params:[a.id,a.kind,a.code,a.name,a.asrama_name,(0,b.now)()]})))}async function n(){return await k(),await m(),(0,b.query)(`
    SELECT id, kind, code, name, asrama_name, is_active
    FROM operasional_unit
    WHERE is_active = 1
    ORDER BY
      CASE kind WHEN 'SEKPEN' THEN 0 WHEN 'KEAMANAN' THEN 1 ELSE 2 END,
      asrama_name,
      name
  `)}async function o(a){await k();let b=a??await (0,c.getSession)();if(!b)return null;let d=await n(),e=new Set;(0,c.isAdmin)(b)||(0,c.hasRole)(b,"bendahara")?d.forEach(a=>e.add(a.id)):((0,c.hasRole)(b,"sekpen")&&e.add("SEKPEN"),(0,c.hasRole)(b,"keamanan")&&e.add("KEAMANAN"),(0,c.hasRole)(b,"pengurus_asrama")&&b.asrama_binaan&&e.add(g(b.asrama_binaan)));let f=d.filter(a=>e.has(a.id));if(0===f.length)return null;let h=(0,c.isAdmin)(b)||(0,c.hasRole)(b,"bendahara");return{canManageAll:h,lockedUnitId:h||1!==f.length?null:f[0].id,defaultUnitId:f[0].id,unitOptions:f,roles:b.roles??[b.role]}}async function p(){let a=await (0,c.getSession)();if(!a)throw Error("Unauthorized");let b=await o(a);if(!b)throw Error("Akses ke kas operasional tidak tersedia untuk akun ini.");return{session:a,scope:b}}function q(a,b){if(!(b.canManageAll||(0,c.isAdmin)(a)||(0,c.hasRole)(a,"bendahara")))throw Error("Hanya bendahara yang bisa mengelola alokasi.")}function r(a,b){if(!a.canManageAll&&!a.unitOptions.some(a=>a.id===b))throw Error("Unit ledger di luar jangkauan akun ini.")}async function s(a){return await k(),(0,b.queryOne)("SELECT id, kind, code, name, asrama_name, is_active FROM operasional_unit WHERE id = ? LIMIT 1",[a])}async function t(a){let c=await (0,b.queryOne)(`
    SELECT COALESCE(SUM(
      CASE
        WHEN tipe = 'PENGELUARAN' THEN -nominal
        ELSE nominal
      END
    ), 0) as saldo
    FROM operasional_transaksi
    WHERE unit_id = ? AND is_deleted = 0
  `,[a]);return i(c?.saldo)}async function u(a,c,d){if(!a.length)return new Map;let e=a.map(()=>"?").join(","),f=[...a,100*c+d];return new Map((await (0,b.query)(`
    SELECT unit_id, COALESCE(SUM(
      CASE
        WHEN tipe = 'PENGELUARAN' THEN -nominal
        ELSE nominal
      END
    ), 0) AS saldo
    FROM operasional_transaksi
    WHERE unit_id IN (${e})
      AND is_deleted = 0
      AND (periode_tahun * 100 + periode_bulan) < ?
    GROUP BY unit_id
  `,f)).map(a=>[a.unit_id,i(a.saldo)]))}async function v(a,c,d){if(!d.length)return[];let e=d.map(()=>"?").join(","),f=[a,c,...d];return(0,b.query)(`
    SELECT
      a.id, a.tahun, a.bulan, a.unit_id, a.nominal, a.catatan, a.status, a.created_by,
      a.created_at, a.updated_at, a.posted_by, a.posted_at, a.cancelled_by, a.cancelled_at,
      u.name as unit_name,
      creator.full_name as creator_name,
      poster.full_name as posted_by_name
    FROM operasional_alokasi_bulanan a
    JOIN operasional_unit u ON u.id = a.unit_id
    LEFT JOIN users creator ON creator.id = a.created_by
    LEFT JOIN users poster ON poster.id = a.posted_by
    WHERE a.tahun = ? AND a.bulan = ? AND a.unit_id IN (${e})
    ORDER BY u.name
  `,f)}async function w(a){let{scope:c}=await p(),d=String(a.unitId||"").trim(),e=d?[d]:c.unitOptions.map(a=>a.id);d&&r(c,d);let f=c.unitOptions.filter(a=>e.includes(a.id)),g=await u(e,a.tahun,a.bulan),h=await v(a.tahun,a.bulan,e),j=e.map(()=>"?").join(","),k=new Map((0===e.length?[]:await (0,b.query)(`
    SELECT
      unit_id,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND sumber_pemasukan = 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as alokasi_bendahara,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND COALESCE(sumber_pemasukan, 'LAINNYA') <> 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as pemasukan_lain,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' THEN nominal ELSE 0 END), 0) as pengeluaran,
      COALESCE(SUM(CASE WHEN tipe = 'PENYESUAIAN' THEN nominal ELSE 0 END), 0) as penyesuaian,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND receipt_url IS NOT NULL AND TRIM(receipt_url) <> '' THEN 1 ELSE 0 END), 0) as ada_bukti,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND (receipt_url IS NULL OR TRIM(receipt_url) = '') THEN 1 ELSE 0 END), 0) as tanpa_bukti
    FROM operasional_transaksi
    WHERE periode_tahun = ? AND periode_bulan = ? AND is_deleted = 0 AND unit_id IN (${j})
    GROUP BY unit_id
  `,[a.tahun,a.bulan,...e])).map(a=>[a.unit_id,a])),l=new Map;for(let a of h)"posted"===a.status&&l.set(a.unit_id,(l.get(a.unit_id)??0)+i(a.nominal));return f.map(a=>{let b=k.get(a.id),c=g.get(a.id)??0,d=b?i(b.alokasi_bendahara):l.get(a.id)??0,e=b?i(b.pemasukan_lain):0,f=b?i(b.pengeluaran):0,h=b?i(b.penyesuaian):0;return{unit_id:a.id,unit_name:a.name,saldo_awal:c,alokasi_bendahara:d,pemasukan_lain:e,pengeluaran:f,penyesuaian:h,saldo_akhir:c+d+e+h-f,ada_bukti:b?i(b.ada_bukti):0,tanpa_bukti:b?i(b.tanpa_bukti):0}})}async function x(a){let{scope:c}=await p();r(c,a.unitId);let d=await s(a.unitId);if(!d)throw Error("Unit operasional tidak ditemukan.");let e=await u([a.unitId],a.tahun,a.bulan),f=await v(a.tahun,a.bulan,[a.unitId]),g=await (0,b.query)(`
    SELECT
      t.id, t.tanggal, t.periode_tahun, t.periode_bulan, t.unit_id, u.name as unit_name, t.tipe,
      t.sumber_pemasukan, t.kategori, t.uraian, t.qty, t.harga_satuan, t.nominal,
      t.partner_name, t.catatan, t.receipt_url, t.alokasi_id, t.is_system, t.created_by,
      creator.full_name as created_by_name, t.created_at, t.updated_at
    FROM operasional_transaksi t
    JOIN operasional_unit u ON u.id = t.unit_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE t.unit_id = ? AND t.periode_tahun = ? AND t.periode_bulan = ? AND t.is_deleted = 0
    ORDER BY t.tanggal ASC, t.created_at ASC
  `,[a.unitId,a.tahun,a.bulan]),h=g.reduce((a,b)=>("PEMASUKAN"===b.tipe&&"ALOKASI_BENDAHARA"===b.sumber_pemasukan?a.alokasi_bendahara+=i(b.nominal):"PEMASUKAN"===b.tipe?a.pemasukan_lain+=i(b.nominal):"PENGELUARAN"===b.tipe?a.pengeluaran+=i(b.nominal):"PENYESUAIAN"===b.tipe&&(a.penyesuaian+=i(b.nominal)),a),{alokasi_bendahara:0,pemasukan_lain:0,pengeluaran:0,penyesuaian:0}),j=e.get(a.unitId)??0;return{unit:d,saldoAwal:j,saldoAkhir:j+h.alokasi_bendahara+h.pemasukan_lain+h.penyesuaian-h.pengeluaran,totals:h,transactions:g,allocations:f}}async function y(a){let{session:c,scope:d}=await p();q(c,d),r(d,a.unitId);let e=await s(a.unitId);if(!e)return{error:"Unit tidak ditemukan."};let f=i(a.tahun),g=i(a.bulan),j=Math.max(0,Math.round(h(a.nominal)));if(f<2e3||g<1||g>12)return{error:"Periode alokasi tidak valid."};if(j<=0)return{error:"Nominal alokasi harus lebih dari 0."};let k=a.id?await (0,b.queryOne)("SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1",[a.id]):await (0,b.queryOne)("SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE tahun = ? AND bulan = ? AND unit_id = ? LIMIT 1",[f,g,a.unitId]);if(k&&a.id&&"posted"===k.status)return{error:"Alokasi yang sudah diposting tidak bisa diubah langsung."};if(k&&"cancelled"===k.status)return{error:"Alokasi yang sudah dibatalkan tidak bisa diubah."};if(k&&!a.id&&k.id&&(a.id=k.id),a.id)return await (0,b.execute)(`
      UPDATE operasional_alokasi_bulanan
      SET tahun = ?, bulan = ?, unit_id = ?, nominal = ?, catatan = ?, updated_at = ?
      WHERE id = ?
    `,[f,g,a.unitId,j,a.catatan?.trim()||null,(0,b.now)(),a.id]),{success:!0,id:a.id,unitName:e.name};let l=(0,b.generateId)();return await (0,b.execute)(`
    INSERT INTO operasional_alokasi_bulanan
      (id, tahun, bulan, unit_id, nominal, catatan, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `,[l,f,g,a.unitId,j,a.catatan?.trim()||null,c.id,(0,b.now)(),(0,b.now)()]),{success:!0,id:l,unitName:e.name}}async function z(a){var c,d;let{session:e,scope:f}=await p();q(e,f);let g=await (0,b.queryOne)(`SELECT a.id, a.tahun, a.bulan, a.unit_id, a.nominal, a.catatan, a.status, a.created_by,
            a.created_at, a.updated_at, a.posted_by, a.posted_at, a.cancelled_by, a.cancelled_at,
            u.name as unit_name, NULL as creator_name, NULL as posted_by_name
     FROM operasional_alokasi_bulanan a
     JOIN operasional_unit u ON u.id = a.unit_id
     WHERE a.id = ? LIMIT 1`,[a]);if(!g)return{error:"Alokasi tidak ditemukan."};if(r(f,g.unit_id),"cancelled"===g.status)return{error:"Alokasi yang dibatalkan tidak bisa diposting."};if("posted"===g.status)return{error:"Alokasi ini sudah diposting."};if(await (0,b.queryOne)("SELECT id FROM operasional_transaksi WHERE alokasi_id = ? AND is_deleted = 0 LIMIT 1",[a]))return{error:"Transaksi alokasi sudah pernah dibuat."};let h=(0,b.generateId)();return await (0,b.batch)([{sql:`
        UPDATE operasional_alokasi_bulanan
        SET status = 'posted', posted_by = ?, posted_at = ?, updated_at = ?
        WHERE id = ?
      `,params:[e.id,(0,b.now)(),(0,b.now)(),a]},{sql:`
        INSERT INTO operasional_transaksi
          (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori,
           uraian, qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id,
           is_system, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PEMASUKAN', 'ALOKASI_BENDAHARA', 'Alokasi Bendahara',
                ?, 1, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?)
      `,params:[h,(c=g.tahun,d=g.bulan,`${c}-${String(d).padStart(2,"0")}-01`),g.tahun,g.bulan,g.unit_id,`Alokasi operasional ${g.unit_name}`,g.nominal,g.nominal,e.full_name,g.catatan,a,e.id,(0,b.now)(),(0,b.now)()]}]),{success:!0,transactionId:h}}async function A(a){let{session:c,scope:d}=await p();q(c,d);let e=await (0,b.queryOne)("SELECT id, unit_id, status FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1",[a]);if(!e)return{error:"Alokasi tidak ditemukan."};if(r(d,e.unit_id),"cancelled"===e.status)return{error:"Alokasi ini sudah dibatalkan."};let f=[{sql:`
      UPDATE operasional_alokasi_bulanan
      SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ?
    `,params:[c.id,(0,b.now)(),(0,b.now)(),a]}];return"posted"===e.status&&f.push({sql:`
        UPDATE operasional_transaksi
        SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
        WHERE alokasi_id = ? AND is_deleted = 0
      `,params:[c.id,(0,b.now)(),(0,b.now)(),a]}),await (0,b.batch)(f),{success:!0}}async function B(a){return(0,b.queryOne)(`
    SELECT
      t.id, t.tanggal, t.periode_tahun, t.periode_bulan, t.unit_id, u.name as unit_name, t.tipe,
      t.sumber_pemasukan, t.kategori, t.uraian, t.qty, t.harga_satuan, t.nominal,
      t.partner_name, t.catatan, t.receipt_url, t.alokasi_id, t.is_system, t.created_by,
      creator.full_name as created_by_name, t.created_at, t.updated_at
    FROM operasional_transaksi t
    JOIN operasional_unit u ON u.id = t.unit_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE t.id = ? AND t.is_deleted = 0
    LIMIT 1
  `,[a])}async function C(a){let{session:c,scope:e}=await p();r(e,a.unitId);let f=await s(a.unitId);if(!f)return{error:"Unit transaksi tidak ditemukan."};let g=a.tipe,k=String(a.tanggal||"").trim();if(!k)return{error:"Tanggal transaksi wajib diisi."};let[l,m]=k.split("-"),n=i(l),o=i(m);if(n<2e3||o<1||o>12)return{error:"Tanggal transaksi tidak valid."};let q=h(a.qty??1),u=q>0?q:1,v=Math.max(0,Math.round(h(a.hargaSatuan))),w=Math.round(h(a.nominal)),x=w;if("PENGELUARAN"===g?x=Math.max(0,Math.round(u*v||w)):"PEMASUKAN"===g&&(x=Math.max(0,w)),"PENYESUAIAN"!==g&&x<=0)return{error:"Nominal transaksi harus lebih dari 0."};if("PENYESUAIAN"===g&&0===x)return{error:"Nominal penyesuaian tidak boleh 0."};let y=a.id?await B(a.id):null;if(y?.is_system)return{error:"Transaksi sistem tidak bisa diubah manual."};if(y&&r(e,y.unit_id),await t(a.unitId)-(y?j(y):0)+j({tipe:g,nominal:x})<0)return{error:"Saldo unit tidak cukup. Pengeluaran atau penyesuaian ini membuat saldo menjadi minus."};let z=a.receiptUrl?.trim()||null;y&&y.receipt_url&&y.receipt_url!==z&&await (0,d.deleteFromR2)(y.receipt_url);let A=a.kategori?.trim()||null,C=a.uraian?.trim();if(!C)return{error:"Uraian transaksi wajib diisi."};let D="PEMASUKAN"===g?"ALOKASI_BENDAHARA"===a.sumberPemasukan?"ALOKASI_BENDAHARA":"LAINNYA":null;if(a.id)return await (0,b.execute)(`
      UPDATE operasional_transaksi
      SET tanggal = ?, periode_tahun = ?, periode_bulan = ?, unit_id = ?, tipe = ?, sumber_pemasukan = ?,
          kategori = ?, uraian = ?, qty = ?, harga_satuan = ?, nominal = ?, partner_name = ?, catatan = ?,
          receipt_url = ?, updated_at = ?
      WHERE id = ?
    `,[k,n,o,a.unitId,g,D,A,C,u,v,x,a.partnerName?.trim()||null,a.catatan?.trim()||null,z,(0,b.now)(),a.id]),{success:!0,id:a.id,unitName:f.name};let E=(0,b.generateId)();return await (0,b.execute)(`
    INSERT INTO operasional_transaksi
      (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori, uraian,
       qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id, is_system,
       created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)
  `,[E,k,n,o,a.unitId,g,D,A,C,u,v,x,a.partnerName?.trim()||null,a.catatan?.trim()||null,z,c.id,(0,b.now)(),(0,b.now)()]),{success:!0,id:E,unitName:f.name}}async function D(a){let{session:c,scope:d}=await p(),e=await B(a);return e?e.is_system?{error:"Transaksi sistem tidak bisa dihapus."}:(r(d,e.unit_id),await t(e.unit_id)-j(e)<0)?{error:"Transaksi ini tidak bisa dihapus karena akan membuat saldo akhir minus."}:(await (0,b.execute)(`
    UPDATE operasional_transaksi
    SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
    WHERE id = ?
  `,[c.id,(0,b.now)(),(0,b.now)(),a]),{success:!0}):{error:"Transaksi tidak ditemukan."}}async function E(a){let{session:c,scope:d}=await p();r(d,a.unitId);let e=String(a.scopeKey||`${c.id}:${a.unitId}`).trim();return await (0,b.queryOne)(`
    SELECT
      id, unit_id, report_type, scope_key,
      slot1_label, slot1_nama, slot1_jabatan,
      slot2_label, slot2_nama, slot2_jabatan,
      slot3_label, slot3_nama, slot3_jabatan
    FROM operasional_ttd_pref
    WHERE unit_id = ? AND report_type = ? AND scope_key = ?
    LIMIT 1
  `,[a.unitId,a.reportType,e])??{unit_id:a.unitId,report_type:a.reportType,scope_key:e,slot1_label:"",slot1_nama:"",slot1_jabatan:"",slot2_label:"",slot2_nama:"",slot2_jabatan:"",slot3_label:"",slot3_nama:"",slot3_jabatan:""}}async function F(a){let{session:c,scope:d}=await p();r(d,a.unit_id);let e=a.scope_key?.trim()||`${c.id}:${a.unit_id}`;return await (0,b.execute)(`
    INSERT INTO operasional_ttd_pref
      (unit_id, report_type, scope_key,
       slot1_label, slot1_nama, slot1_jabatan,
       slot2_label, slot2_nama, slot2_jabatan,
       slot3_label, slot3_nama, slot3_jabatan,
       updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unit_id, report_type, scope_key) DO UPDATE SET
      slot1_label = excluded.slot1_label,
      slot1_nama = excluded.slot1_nama,
      slot1_jabatan = excluded.slot1_jabatan,
      slot2_label = excluded.slot2_label,
      slot2_nama = excluded.slot2_nama,
      slot2_jabatan = excluded.slot2_jabatan,
      slot3_label = excluded.slot3_label,
      slot3_nama = excluded.slot3_nama,
      slot3_jabatan = excluded.slot3_jabatan,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `,[a.unit_id,a.report_type,e,a.slot1_label?.trim()||"",a.slot1_nama?.trim()||"",a.slot1_jabatan?.trim()||"",a.slot2_label?.trim()||"",a.slot2_nama?.trim()||"",a.slot2_jabatan?.trim()||"",a.slot3_label?.trim()||"",a.slot3_nama?.trim()||"",a.slot3_jabatan?.trim()||"",c.id,(0,b.now)(),(0,b.now)()]),{success:!0}}async function G(a){return{ledger:await x({tahun:a.tahun,bulan:a.bulan,unitId:a.unitId}),preferences:await E({unitId:a.unitId,reportType:a.reportType,scopeKey:a.scopeKey})}}a.s(["OPERASIONAL_BENDAHARA_FEATURE",0,"/dashboard/keuangan/operasional","OPERASIONAL_RECIPIENT_FEATURE",0,"/dashboard/operasional","cancelOperasionalAlokasi",()=>A,"deleteOperasionalTransaksi",()=>D,"ensureOperasionalSchema",()=>k,"getOperasionalDashboard",()=>w,"getOperasionalLedger",()=>x,"getOperasionalPrintData",()=>G,"getOperasionalPrintPreferences",()=>E,"getOperasionalScope",()=>o,"postOperasionalAlokasi",()=>z,"saveOperasionalAlokasi",()=>y,"saveOperasionalPrintPreferences",()=>F,"saveOperasionalTransaksi",()=>C])}];

//# sourceMappingURL=lib_operasional_ts_13d3ddf0._.js.map