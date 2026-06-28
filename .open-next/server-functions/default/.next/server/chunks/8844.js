"use strict";exports.id=8844,exports.ids=[8844],exports.modules={2145:(a,b,c)=>{c.d(b,{S:()=>j}),c(48249);var d=c(67484),e=c(59347),f=c(31675),g=c(93026),h=c(41160);let i=(0,d.createContext)(null);function j(){let a=(0,d.useContext)(i);return(0,d.useCallback)((b,c={})=>a?a(b,c):Promise.resolve(window.confirm(b)),[a])}e.A,f.A,g.A,h.A},46416:(a,b,c)=>{c.d(b,{$R:()=>I,Bv:()=>B,C_:()=>D,Li:()=>C,Lm:()=>G,Sh:()=>A,Xz:()=>h,_H:()=>i,cR:()=>J,dk:()=>K,f5:()=>H,km:()=>s,qM:()=>E});var d=c(44916),e=c(46100),f=c(99249),g=c(42650);let h="/dashboard/operasional",i="/dashboard/keuangan/operasional",j=null;function k(a){return`ASRAMA:${a.trim().toUpperCase()}`}function l(a){let b=Number(a);return Number.isFinite(b)?b:0}function m(a,b=0){let c=Number.parseInt(String(a??b),10);return Number.isFinite(c)?c:b}function n(a){return"PENGELUARAN"===a.tipe?-Number(a.nominal||0):Number(a.nominal||0)}async function o(){j??=p().catch(a=>{throw j=null,a}),await j}async function p(){await (0,d.g7)(`
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
  `),await (0,d.g7)(`
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
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_alokasi_periode
    ON operasional_alokasi_bulanan(tahun, bulan, unit_id, status)
  `),await (0,d.g7)(`
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
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_periode
    ON operasional_transaksi(periode_tahun, periode_bulan, unit_id, tipe, is_deleted)
  `),await (0,d.g7)(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_alokasi
    ON operasional_transaksi(alokasi_id, is_deleted)
  `),await (0,d.g7)(`
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
  `),await (0,d.g7)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES
      ('Keuangan Santri', 'Kas Operasional Unit', '/dashboard/operasional', 'WalletCards', '["admin","pengurus_asrama","sekpen","keamanan"]', 1, 0),
      ('Keuangan Pusat', 'Operasional Unit', '/dashboard/keuangan/operasional', 'Wallet', '["admin","bendahara"]', 1, 3)
  `),await (0,d.g7)("UPDATE fitur_akses SET group_name = 'Keuangan Santri', roles = '[\"admin\",\"pengurus_asrama\",\"sekpen\",\"keamanan\"]', updated_at = datetime('now') WHERE href = '/dashboard/operasional'"),await (0,d.g7)("UPDATE fitur_akses SET group_name = 'Keuangan Pusat', updated_at = datetime('now') WHERE href = '/dashboard/keuangan/operasional'"),await (0,d.g7)("DELETE FROM fitur_akses WHERE href IN ('/dashboard/operasional/cetak', '/dashboard/keuangan/operasional/cetak')");try{(0,g.revalidateTag)("fitur-akses","everything")}catch{}await q()}async function q(){let a=[{id:"SEKPEN",kind:"SEKPEN",code:"SEKPEN",name:"Sekpen",asrama_name:null},{id:"KEAMANAN",kind:"KEAMANAN",code:"KEAMANAN",name:"Keamanan",asrama_name:null},...(await (0,d.P)(`
    SELECT DISTINCT TRIM(asrama) as asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND TRIM(asrama) <> ''
      AND UPPER(TRIM(asrama)) <> 'AL-BAGHORY'
    ORDER BY TRIM(asrama)
  `)).map(a=>{let b=a.asrama.trim();return{id:k(b),kind:"ASRAMA",code:k(b),name:b,asrama_name:b}})];a.length>0&&await (0,d.vA)(a.map(a=>({sql:`
        INSERT INTO operasional_unit (id, kind, code, name, asrama_name, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          code = excluded.code,
          name = excluded.name,
          asrama_name = excluded.asrama_name,
          is_active = 1,
          updated_at = excluded.updated_at
      `,params:[a.id,a.kind,a.code,a.name,a.asrama_name,(0,d.tB)()]})))}async function r(){return await o(),await q(),(0,d.P)(`
    SELECT id, kind, code, name, asrama_name, is_active
    FROM operasional_unit
    WHERE is_active = 1
    ORDER BY
      CASE kind WHEN 'SEKPEN' THEN 0 WHEN 'KEAMANAN' THEN 1 ELSE 2 END,
      asrama_name,
      name
  `)}async function s(a){await o();let b=a??await (0,e.Ht)();if(!b)return null;let c=await r(),d=new Set;(0,e.qc)(b)||(0,e.hf)(b,"bendahara")?c.forEach(a=>d.add(a.id)):((0,e.hf)(b,"sekpen")&&d.add("SEKPEN"),(0,e.hf)(b,"keamanan")&&d.add("KEAMANAN"),(0,e.hf)(b,"pengurus_asrama")&&b.asrama_binaan&&d.add(k(b.asrama_binaan)));let f=c.filter(a=>d.has(a.id));if(0===f.length)return null;let g=(0,e.qc)(b)||(0,e.hf)(b,"bendahara");return{canManageAll:g,lockedUnitId:g||1!==f.length?null:f[0].id,defaultUnitId:f[0].id,unitOptions:f,roles:b.roles??[b.role]}}async function t(){let a=await (0,e.Ht)();if(!a)throw Error("Unauthorized");let b=await s(a);if(!b)throw Error("Akses ke kas operasional tidak tersedia untuk akun ini.");return{session:a,scope:b}}function u(a,b){if(!(b.canManageAll||(0,e.qc)(a)||(0,e.hf)(a,"bendahara")))throw Error("Hanya bendahara yang bisa mengelola alokasi.")}function v(a,b){if(!a.canManageAll&&!a.unitOptions.some(a=>a.id===b))throw Error("Unit ledger di luar jangkauan akun ini.")}async function w(a){return await o(),(0,d.Zy)("SELECT id, kind, code, name, asrama_name, is_active FROM operasional_unit WHERE id = ? LIMIT 1",[a])}async function x(a){let b=await (0,d.Zy)(`
    SELECT COALESCE(SUM(
      CASE
        WHEN tipe = 'PENGELUARAN' THEN -nominal
        ELSE nominal
      END
    ), 0) as saldo
    FROM operasional_transaksi
    WHERE unit_id = ? AND is_deleted = 0
  `,[a]);return m(b?.saldo)}async function y(a,b,c){if(!a.length)return new Map;let e=a.map(()=>"?").join(","),f=[...a,100*b+c];return new Map((await (0,d.P)(`
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
  `,f)).map(a=>[a.unit_id,m(a.saldo)]))}async function z(a,b,c){if(!c.length)return[];let e=c.map(()=>"?").join(","),f=[a,b,...c];return(0,d.P)(`
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
  `,f)}async function A(a){let{scope:b}=await t(),c=String(a.unitId||"").trim(),e=c?[c]:b.unitOptions.map(a=>a.id);c&&v(b,c);let f=b.unitOptions.filter(a=>e.includes(a.id)),g=await y(e,a.tahun,a.bulan),h=await z(a.tahun,a.bulan,e),i=e.map(()=>"?").join(","),j=new Map((0===e.length?[]:await (0,d.P)(`
    SELECT
      unit_id,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND sumber_pemasukan = 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as alokasi_bendahara,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND COALESCE(sumber_pemasukan, 'LAINNYA') <> 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as pemasukan_lain,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' THEN nominal ELSE 0 END), 0) as pengeluaran,
      COALESCE(SUM(CASE WHEN tipe = 'PENYESUAIAN' THEN nominal ELSE 0 END), 0) as penyesuaian,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND receipt_url IS NOT NULL AND TRIM(receipt_url) <> '' THEN 1 ELSE 0 END), 0) as ada_bukti,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND (receipt_url IS NULL OR TRIM(receipt_url) = '') THEN 1 ELSE 0 END), 0) as tanpa_bukti
    FROM operasional_transaksi
    WHERE periode_tahun = ? AND periode_bulan = ? AND is_deleted = 0 AND unit_id IN (${i})
    GROUP BY unit_id
  `,[a.tahun,a.bulan,...e])).map(a=>[a.unit_id,a])),k=new Map;for(let a of h)"posted"===a.status&&k.set(a.unit_id,(k.get(a.unit_id)??0)+m(a.nominal));return f.map(a=>{let b=j.get(a.id),c=g.get(a.id)??0,d=b?m(b.alokasi_bendahara):k.get(a.id)??0,e=b?m(b.pemasukan_lain):0,f=b?m(b.pengeluaran):0,h=b?m(b.penyesuaian):0;return{unit_id:a.id,unit_name:a.name,saldo_awal:c,alokasi_bendahara:d,pemasukan_lain:e,pengeluaran:f,penyesuaian:h,saldo_akhir:c+d+e+h-f,ada_bukti:b?m(b.ada_bukti):0,tanpa_bukti:b?m(b.tanpa_bukti):0}})}async function B(a){let{scope:b}=await t();v(b,a.unitId);let c=await w(a.unitId);if(!c)throw Error("Unit operasional tidak ditemukan.");let e=await y([a.unitId],a.tahun,a.bulan),f=await z(a.tahun,a.bulan,[a.unitId]),g=await (0,d.P)(`
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
  `,[a.unitId,a.tahun,a.bulan]),h=g.reduce((a,b)=>("PEMASUKAN"===b.tipe&&"ALOKASI_BENDAHARA"===b.sumber_pemasukan?a.alokasi_bendahara+=m(b.nominal):"PEMASUKAN"===b.tipe?a.pemasukan_lain+=m(b.nominal):"PENGELUARAN"===b.tipe?a.pengeluaran+=m(b.nominal):"PENYESUAIAN"===b.tipe&&(a.penyesuaian+=m(b.nominal)),a),{alokasi_bendahara:0,pemasukan_lain:0,pengeluaran:0,penyesuaian:0}),i=e.get(a.unitId)??0;return{unit:c,saldoAwal:i,saldoAkhir:i+h.alokasi_bendahara+h.pemasukan_lain+h.penyesuaian-h.pengeluaran,totals:h,transactions:g,allocations:f}}async function C(a){let{session:b,scope:c}=await t();u(b,c),v(c,a.unitId);let e=await w(a.unitId);if(!e)return{error:"Unit tidak ditemukan."};let f=m(a.tahun),g=m(a.bulan),h=Math.max(0,Math.round(l(a.nominal)));if(f<2e3||g<1||g>12)return{error:"Periode alokasi tidak valid."};if(h<=0)return{error:"Nominal alokasi harus lebih dari 0."};let i=a.id?await (0,d.Zy)("SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1",[a.id]):await (0,d.Zy)("SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE tahun = ? AND bulan = ? AND unit_id = ? LIMIT 1",[f,g,a.unitId]);if(i&&a.id&&"posted"===i.status)return{error:"Alokasi yang sudah diposting tidak bisa diubah langsung."};if(i&&"cancelled"===i.status)return{error:"Alokasi yang sudah dibatalkan tidak bisa diubah."};if(i&&!a.id&&i.id&&(a.id=i.id),a.id)return await (0,d.g7)(`
      UPDATE operasional_alokasi_bulanan
      SET tahun = ?, bulan = ?, unit_id = ?, nominal = ?, catatan = ?, updated_at = ?
      WHERE id = ?
    `,[f,g,a.unitId,h,a.catatan?.trim()||null,(0,d.tB)(),a.id]),{success:!0,id:a.id,unitName:e.name};let j=(0,d.$C)();return await (0,d.g7)(`
    INSERT INTO operasional_alokasi_bulanan
      (id, tahun, bulan, unit_id, nominal, catatan, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `,[j,f,g,a.unitId,h,a.catatan?.trim()||null,b.id,(0,d.tB)(),(0,d.tB)()]),{success:!0,id:j,unitName:e.name}}async function D(a){var b,c;let{session:e,scope:f}=await t();u(e,f);let g=await (0,d.Zy)(`SELECT a.id, a.tahun, a.bulan, a.unit_id, a.nominal, a.catatan, a.status, a.created_by,
            a.created_at, a.updated_at, a.posted_by, a.posted_at, a.cancelled_by, a.cancelled_at,
            u.name as unit_name, NULL as creator_name, NULL as posted_by_name
     FROM operasional_alokasi_bulanan a
     JOIN operasional_unit u ON u.id = a.unit_id
     WHERE a.id = ? LIMIT 1`,[a]);if(!g)return{error:"Alokasi tidak ditemukan."};if(v(f,g.unit_id),"cancelled"===g.status)return{error:"Alokasi yang dibatalkan tidak bisa diposting."};if("posted"===g.status)return{error:"Alokasi ini sudah diposting."};if(await (0,d.Zy)("SELECT id FROM operasional_transaksi WHERE alokasi_id = ? AND is_deleted = 0 LIMIT 1",[a]))return{error:"Transaksi alokasi sudah pernah dibuat."};let h=(0,d.$C)();return await (0,d.vA)([{sql:`
        UPDATE operasional_alokasi_bulanan
        SET status = 'posted', posted_by = ?, posted_at = ?, updated_at = ?
        WHERE id = ?
      `,params:[e.id,(0,d.tB)(),(0,d.tB)(),a]},{sql:`
        INSERT INTO operasional_transaksi
          (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori,
           uraian, qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id,
           is_system, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PEMASUKAN', 'ALOKASI_BENDAHARA', 'Alokasi Bendahara',
                ?, 1, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?)
      `,params:[h,(b=g.tahun,c=g.bulan,`${b}-${String(c).padStart(2,"0")}-01`),g.tahun,g.bulan,g.unit_id,`Alokasi operasional ${g.unit_name}`,g.nominal,g.nominal,e.full_name,g.catatan,a,e.id,(0,d.tB)(),(0,d.tB)()]}]),{success:!0,transactionId:h}}async function E(a){let{session:b,scope:c}=await t();u(b,c);let e=await (0,d.Zy)("SELECT id, unit_id, status FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1",[a]);if(!e)return{error:"Alokasi tidak ditemukan."};if(v(c,e.unit_id),"cancelled"===e.status)return{error:"Alokasi ini sudah dibatalkan."};let f=[{sql:`
      UPDATE operasional_alokasi_bulanan
      SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ?
    `,params:[b.id,(0,d.tB)(),(0,d.tB)(),a]}];return"posted"===e.status&&f.push({sql:`
        UPDATE operasional_transaksi
        SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
        WHERE alokasi_id = ? AND is_deleted = 0
      `,params:[b.id,(0,d.tB)(),(0,d.tB)(),a]}),await (0,d.vA)(f),{success:!0}}async function F(a){return(0,d.Zy)(`
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
  `,[a])}async function G(a){let{session:b,scope:c}=await t();v(c,a.unitId);let e=await w(a.unitId);if(!e)return{error:"Unit transaksi tidak ditemukan."};let g=a.tipe,h=String(a.tanggal||"").trim();if(!h)return{error:"Tanggal transaksi wajib diisi."};let[i,j]=h.split("-"),k=m(i),o=m(j);if(k<2e3||o<1||o>12)return{error:"Tanggal transaksi tidak valid."};let p=l(a.qty??1),q=p>0?p:1,r=Math.max(0,Math.round(l(a.hargaSatuan))),s=Math.round(l(a.nominal)),u=s;if("PENGELUARAN"===g?u=Math.max(0,Math.round(q*r||s)):"PEMASUKAN"===g&&(u=Math.max(0,s)),"PENYESUAIAN"!==g&&u<=0)return{error:"Nominal transaksi harus lebih dari 0."};if("PENYESUAIAN"===g&&0===u)return{error:"Nominal penyesuaian tidak boleh 0."};let y=a.id?await F(a.id):null;if(y?.is_system)return{error:"Transaksi sistem tidak bisa diubah manual."};if(y&&v(c,y.unit_id),await x(a.unitId)-(y?n(y):0)+n({tipe:g,nominal:u})<0)return{error:"Saldo unit tidak cukup. Pengeluaran atau penyesuaian ini membuat saldo menjadi minus."};let z=a.receiptUrl?.trim()||null;y&&y.receipt_url&&y.receipt_url!==z&&await (0,f.w4)(y.receipt_url);let A=a.kategori?.trim()||null,B=a.uraian?.trim();if(!B)return{error:"Uraian transaksi wajib diisi."};let C="PEMASUKAN"===g?"ALOKASI_BENDAHARA"===a.sumberPemasukan?"ALOKASI_BENDAHARA":"LAINNYA":null;if(a.id)return await (0,d.g7)(`
      UPDATE operasional_transaksi
      SET tanggal = ?, periode_tahun = ?, periode_bulan = ?, unit_id = ?, tipe = ?, sumber_pemasukan = ?,
          kategori = ?, uraian = ?, qty = ?, harga_satuan = ?, nominal = ?, partner_name = ?, catatan = ?,
          receipt_url = ?, updated_at = ?
      WHERE id = ?
    `,[h,k,o,a.unitId,g,C,A,B,q,r,u,a.partnerName?.trim()||null,a.catatan?.trim()||null,z,(0,d.tB)(),a.id]),{success:!0,id:a.id,unitName:e.name};let D=(0,d.$C)();return await (0,d.g7)(`
    INSERT INTO operasional_transaksi
      (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori, uraian,
       qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id, is_system,
       created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)
  `,[D,h,k,o,a.unitId,g,C,A,B,q,r,u,a.partnerName?.trim()||null,a.catatan?.trim()||null,z,b.id,(0,d.tB)(),(0,d.tB)()]),{success:!0,id:D,unitName:e.name}}async function H(a){let{session:b,scope:c}=await t(),e=await F(a);return e?e.is_system?{error:"Transaksi sistem tidak bisa dihapus."}:(v(c,e.unit_id),await x(e.unit_id)-n(e)<0)?{error:"Transaksi ini tidak bisa dihapus karena akan membuat saldo akhir minus."}:(await (0,d.g7)(`
    UPDATE operasional_transaksi
    SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
    WHERE id = ?
  `,[b.id,(0,d.tB)(),(0,d.tB)(),a]),{success:!0}):{error:"Transaksi tidak ditemukan."}}async function I(a){let{session:b,scope:c}=await t();v(c,a.unitId);let e=String(a.scopeKey||`${b.id}:${a.unitId}`).trim();return await (0,d.Zy)(`
    SELECT
      id, unit_id, report_type, scope_key,
      slot1_label, slot1_nama, slot1_jabatan,
      slot2_label, slot2_nama, slot2_jabatan,
      slot3_label, slot3_nama, slot3_jabatan
    FROM operasional_ttd_pref
    WHERE unit_id = ? AND report_type = ? AND scope_key = ?
    LIMIT 1
  `,[a.unitId,a.reportType,e])??{unit_id:a.unitId,report_type:a.reportType,scope_key:e,slot1_label:"",slot1_nama:"",slot1_jabatan:"",slot2_label:"",slot2_nama:"",slot2_jabatan:"",slot3_label:"",slot3_nama:"",slot3_jabatan:""}}async function J(a){let{session:b,scope:c}=await t();v(c,a.unit_id);let e=a.scope_key?.trim()||`${b.id}:${a.unit_id}`;return await (0,d.g7)(`
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
  `,[a.unit_id,a.report_type,e,a.slot1_label?.trim()||"",a.slot1_nama?.trim()||"",a.slot1_jabatan?.trim()||"",a.slot2_label?.trim()||"",a.slot2_nama?.trim()||"",a.slot2_jabatan?.trim()||"",a.slot3_label?.trim()||"",a.slot3_nama?.trim()||"",a.slot3_jabatan?.trim()||"",b.id,(0,d.tB)(),(0,d.tB)()]),{success:!0}}async function K(a){return{ledger:await B({tahun:a.tahun,bulan:a.bulan,unitId:a.unitId}),preferences:await I({unitId:a.unitId,reportType:a.reportType,scopeKey:a.scopeKey})}}},48072:(a,b,c)=>{c.d(b,{R8:()=>h});var d=c(67484),e=c(64333);function f(a,b){let c=a||b||"dokumen";return((c.endsWith(".pdf")?c.slice(0,-4):c).replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"dokumen")+".pdf"}async function g({contentRef:a,documentTitle:b,filename:c,pageStyle:d,pdfOptions:e}){var g,h,i;let j,k,l,m,n=a?.current;if(!n)throw Error("Area cetak belum siap.");let o=b||c||document.title||"Dokumen",p=(g=function(a){if(a instanceof Element)return a.outerHTML;let b=document.createElement("div");return b.textContent=a.textContent||"",b.outerHTML}(n),j=d?`<style>${d}</style>`:"",`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${"/".replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${o.replace(/[<>&"]/g,"")}</title>
  ${k=[],document.querySelectorAll('link[rel="stylesheet"][href]').forEach(a=>{let b=a.href;b&&k.push(`<link rel="stylesheet" href="${b}">`)}),document.querySelectorAll("style").forEach(a=>{k.push(`<style>${a.textContent||""}</style>`)}),k.join("\n")}
  ${j}
</head>
<body>
  ${g}
</body>
</html>`);if(p.length>0x2d00000)throw Error("Dokumen terlalu besar untuk dibuat PDF dari perangkat ini.");let q=await fetch("/api/pdf/from-html",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({html:p,title:o,filename:f(c,b),pageStyle:d,pdfOptions:e})});if(!q.ok){let a="Gagal membuat PDF.";try{let b=await q.json();b?.error&&(a=b.error)}catch{}throw Error(a)}h=await q.blob(),i=f(c,b),l=URL.createObjectURL(h),(m=document.createElement("a")).href=l,m.download=i,document.body.appendChild(m),m.click(),m.remove(),window.setTimeout(()=>URL.revokeObjectURL(l),1e3)}function h(a){let b=(0,e.useReactToPrint)(a),c=(0,d.useCallback)(async()=>{await g({contentRef:a.contentRef,documentTitle:a.documentTitle,filename:a.filename,pageStyle:a.pageStyle,pdfOptions:a.pdfOptions})},[a.contentRef,a.documentTitle,a.filename,a.pageStyle,a.pdfOptions]);return(0,d.useCallback)(async()=>{b()},[c,b,a])}},65754:(a,b,c)=>{c.d(b,{u:()=>j});var d=c(48249),e=c(67484),f=c.n(e),g=c(29835),h=c(99549);let i=["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],j=f().forwardRef(({ledger:a,preferences:b,bulan:c,tahun:e,subtitle:f,preview:j=!1},n)=>{let o=(0,g.GP)(new Date,"dd MMMM yyyy",{locale:h.id}),p=`${i[c]} ${e}`;return(0,d.jsxs)("div",{ref:n,className:`bg-white text-black ${j?"operasional-print-preview":""}`,children:[(0,d.jsx)("style",{dangerouslySetInnerHTML:{__html:`
            .operasional-print-sheet {
              width: 190mm;
              min-height: 277mm;
              padding: 10mm 12mm;
              color: #111827;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }
            .operasional-print-sheet * { box-sizing: border-box; }
            .operasional-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .operasional-print-sheet th,
            .operasional-print-sheet td { border: 1px solid #0f172a; padding: 5px 6px; vertical-align: top; }
            .operasional-print-sheet th { background: #e2e8f0; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .operasional-print-sheet td { font-size: 10px; }
            .operasional-print-sheet .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
            .operasional-print-sheet .summary-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
            .operasional-print-sheet .summary-card-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; }
            .operasional-print-sheet .summary-card-value { margin-top: 4px; font-size: 17px; font-weight: 700; }
            .operasional-print-sheet .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
            .operasional-print-sheet .signature-box { text-align: center; font-size: 11px; }
            .operasional-print-sheet .signature-space { height: 64px; }
            .operasional-print-sheet .muted { color: #64748b; }
            .operasional-print-preview {
              width: 100%;
              min-width: 760px;
            }
            .operasional-print-preview .operasional-print-sheet {
              width: 100%;
              min-width: 760px;
              min-height: auto;
              padding: 10mm;
              margin: 0 auto;
            }
            @page { size: F4 portrait; margin: 10mm; }
            @media print {
              html, body { background: white !important; }
              .operasional-print-sheet { width: 100%; min-height: auto; padding: 0; }
            }
          `}}),(0,d.jsxs)("div",{className:"operasional-print-sheet",children:[(0,d.jsxs)("div",{className:"text-center",children:[(0,d.jsx)("div",{className:"text-[22px] font-bold uppercase tracking-wide",children:"Laporan Kas Operasional"}),(0,d.jsx)("div",{className:"mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-600",children:f}),(0,d.jsx)("div",{className:"mt-2 text-[14px] font-semibold uppercase",children:a.unit.name})]}),(0,d.jsxs)("div",{className:"mt-4 flex items-start justify-between gap-6",children:[(0,d.jsxs)("div",{className:"space-y-1 text-[11px] font-semibold",children:[(0,d.jsxs)("div",{className:"flex gap-2",children:[(0,d.jsx)("span",{className:"w-20",children:"Periode"}),(0,d.jsx)("span",{children:":"}),(0,d.jsx)("span",{children:p})]}),(0,d.jsxs)("div",{className:"flex gap-2",children:[(0,d.jsx)("span",{className:"w-20",children:"Unit"}),(0,d.jsx)("span",{children:":"}),(0,d.jsx)("span",{children:a.unit.name})]})]}),(0,d.jsx)("div",{className:"text-right text-[10px] text-slate-600",children:(0,d.jsxs)("div",{children:["Dicetak pada ",o]})})]}),(0,d.jsxs)("div",{className:"summary-grid",children:[(0,d.jsx)(k,{label:"Saldo Awal",value:m(a.saldoAwal)}),(0,d.jsx)(k,{label:"Total Pemasukan",value:m(a.totals.alokasi_bendahara+a.totals.pemasukan_lain+Math.max(0,a.totals.penyesuaian))}),(0,d.jsx)(k,{label:"Total Pengeluaran",value:m(a.totals.pengeluaran+Math.abs(Math.min(0,a.totals.penyesuaian)))}),(0,d.jsx)(k,{label:"Saldo Akhir",value:m(a.saldoAkhir)})]}),(0,d.jsxs)("table",{children:[(0,d.jsx)("thead",{children:(0,d.jsxs)("tr",{children:[(0,d.jsx)("th",{style:{width:"30px"},children:"No"}),(0,d.jsx)("th",{style:{width:"70px"},children:"Tanggal"}),(0,d.jsx)("th",{style:{width:"74px"},children:"Tipe"}),(0,d.jsx)("th",{style:{width:"80px"},children:"Kategori"}),(0,d.jsx)("th",{children:"Uraian"}),(0,d.jsx)("th",{style:{width:"54px"},children:"Qty"}),(0,d.jsx)("th",{style:{width:"88px"},children:"Harga"}),(0,d.jsx)("th",{style:{width:"102px"},children:"Nominal"})]})}),(0,d.jsxs)("tbody",{children:[0===a.transactions.length?(0,d.jsx)("tr",{children:(0,d.jsx)("td",{colSpan:8,className:"text-center muted",children:"Belum ada transaksi pada periode ini."})}):a.transactions.map((a,b)=>{var c,e;let f;return(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{className:"text-center",children:b+1}),(0,d.jsx)("td",{children:Number.isNaN((f=new Date(c=a.tanggal)).getTime())?c:(0,g.GP)(f,"dd/MM/yyyy")}),(0,d.jsx)("td",{children:a.tipe}),(0,d.jsx)("td",{children:a.kategori||("ALOKASI_BENDAHARA"===a.sumber_pemasukan?"Alokasi Bendahara":"-")}),(0,d.jsxs)("td",{children:[(0,d.jsx)("div",{className:"font-medium",children:a.uraian}),a.partner_name?(0,d.jsx)("div",{className:"muted",children:a.partner_name}):null,a.catatan?(0,d.jsx)("div",{className:"muted",children:a.catatan}):null]}),(0,d.jsx)("td",{className:"text-center",children:(e=a.qty,new Intl.NumberFormat("id-ID",{maximumFractionDigits:2*(e%1!=0)}).format(e))}),(0,d.jsx)("td",{className:"text-right",children:m(a.harga_satuan)}),(0,d.jsx)("td",{className:"text-right",children:m(a.nominal)})]},a.id)}),(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{colSpan:7,className:"text-right font-bold",children:"Saldo Awal"}),(0,d.jsx)("td",{className:"text-right font-bold",children:m(a.saldoAwal)})]}),(0,d.jsxs)("tr",{children:[(0,d.jsx)("td",{colSpan:7,className:"text-right font-bold",children:"Saldo Akhir"}),(0,d.jsx)("td",{className:"text-right font-bold",children:m(a.saldoAkhir)})]})]})]}),(0,d.jsxs)("div",{className:"signature-grid",children:[(0,d.jsx)(l,{label:b.slot1_label,nama:b.slot1_nama,jabatan:b.slot1_jabatan}),(0,d.jsx)(l,{label:b.slot2_label,nama:b.slot2_nama,jabatan:b.slot2_jabatan}),(0,d.jsx)(l,{label:b.slot3_label,nama:b.slot3_nama,jabatan:b.slot3_jabatan})]})]})]})});function k({label:a,value:b}){return(0,d.jsxs)("div",{className:"summary-card",children:[(0,d.jsx)("div",{className:"summary-card-label",children:a}),(0,d.jsx)("div",{className:"summary-card-value",children:b})]})}function l({label:a,nama:b,jabatan:c}){return(0,d.jsxs)("div",{className:"signature-box",children:[(0,d.jsx)("div",{children:a||"...................."}),(0,d.jsx)("div",{className:"signature-space"}),(0,d.jsx)("div",{className:"font-medium",children:b||"........................................"}),(0,d.jsx)("div",{className:"muted",children:c||"........................................"})]})}function m(a){return`Rp ${new Intl.NumberFormat("id-ID").format(a)}`}j.displayName="OperasionalPrintSheet"},99249:(a,b,c)=>{c.d(b,{R_:()=>i,w4:()=>j});var d=c(46732);async function e(){let{env:a}=await (0,d.DM)({async:!0});return a.R2_BUCKET}function f(a){return a.replace(/[^a-zA-Z0-9/_-]+/g,"-").replace(/\/+/g,"/").replace(/^-+|-+$/g,"")}function g(a){return a instanceof Error?a.message:String(a)}async function h(a){try{var b;let c=await e(),d=(b=a.contentType||"image/jpeg").includes("png")?"png":b.includes("webp")?"webp":b.includes("gif")?"gif":"jpg",g=f(a.folder||"uploads")||"uploads",h=f(a.filenamePrefix||"file")||"file",i=`${g}/${h}_${Date.now()}.${d}`;return await c.put(i,a.buffer,{httpMetadata:{contentType:a.contentType||"image/jpeg",cacheControl:"public, max-age=31536000"}}),{url:`/api/file/${i}`}}catch(a){return{error:`Gagal upload: ${g(a)}`}}}async function i(a,b,c="foto-santri"){try{let d=await a.arrayBuffer();return h({buffer:d,folder:c,filenamePrefix:b,contentType:a.type||"image/jpeg"})}catch(a){return{error:`Gagal upload: ${g(a)}`}}}async function j(a){try{let b=await e(),c=process.env.R2_PUBLIC_URL,d=a;if(d.startsWith("/api/file/"))d=d.slice(10);else if(c&&d.startsWith(`${c}/`))d=d.slice(c.length+1);else{let a=d.match(/^https?:\/\/[^/]+\/(.+)$/);a&&(d=a[1])}d&&d!==a&&await b.delete(d)}catch{console.error("Gagal hapus file lama dari R2")}}}};