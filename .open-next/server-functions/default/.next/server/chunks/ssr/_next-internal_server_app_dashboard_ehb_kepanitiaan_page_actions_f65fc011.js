module.exports=[66223,a=>{"use strict";var b=a.i(24895),c=a.i(37936),d=a.i(12259),e=a.i(53058),f=a.i(6846),g=a.i(18558),h=a.i(13095);async function i(){await (0,d.execute)(`
    CREATE TABLE IF NOT EXISTS ehb_panitia (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      tipe           TEXT NOT NULL,
      jabatan_key    TEXT,
      seksi_key      TEXT,
      peran          TEXT,
      guru_id        INTEGER REFERENCES data_guru(id),
      nama           TEXT NOT NULL,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `),await (0,d.execute)(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ehb_panitia_inti_unique
    ON ehb_panitia(ehb_event_id, jabatan_key)
    WHERE tipe = 'inti'
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_panitia_event
    ON ehb_panitia(ehb_event_id, tipe, seksi_key, urutan)
  `),await (0,d.execute)(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('EHB', 'Kepanitiaan', '/dashboard/ehb/kepanitiaan', 'UserCog', '["admin"]', 1, 11)
  `),await (0,d.execute)(`
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
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_event
    ON ehb_pembuat_soal(ehb_event_id, guru_id)
  `),await (0,d.execute)(`
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
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_marhalah_event
    ON ehb_pembuat_soal_marhalah(ehb_event_id, marhalah_id, guru_id)
  `),await (0,d.execute)(`
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
  `),await (0,d.execute)(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_scope_event
    ON ehb_pembuat_soal_scope(ehb_event_id, scope_type, guru_id)
  `)}async function j(){return await i(),(0,d.queryOne)(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1
    LIMIT 1
  `)}async function k(){return(0,d.query)(`
    SELECT id, nama_lengkap as nama
    FROM data_guru
    ORDER BY nama_lengkap
  `)}async function l(){return(0,d.query)(`
    SELECT id, nama_lengkap as nama, nis, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND kategori_santri = 'SADESA'
    ORDER BY nama_lengkap
  `)}async function m(a){return await i(),(0,d.query)(`
    SELECT e.id, e.nama, e.semester, e.tanggal_mulai, e.tanggal_selesai, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.id <> ?
    ORDER BY e.id DESC
  `,[a])}async function n(a){return await i(),(0,d.query)(`
    SELECT id, ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ?
    ORDER BY
      CASE tipe WHEN 'inti' THEN 0 ELSE 1 END,
      urutan,
      nama
  `,[a])}async function o(a,b){let c=await (0,d.queryOne)(`
    SELECT MAX(urutan) as max_urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'seksi' AND seksi_key = ?
  `,[a,b]);return(c?.max_urutan??0)+1}async function p(a,b,c){let h=await (0,e.getSession)();if(!h)return{error:"Unauthorized"};await i();let j=b.nama.trim();if(!j)return{error:"Nama panitia wajib diisi"};if("inti"===b.tipe){if(!b.jabatan_key)return{error:"Jabatan inti wajib dipilih"};let e=x[b.jabatan_key]??99,f=await (0,d.queryOne)(`
      SELECT id FROM ehb_panitia
      WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = ?
      LIMIT 1
    `,[a,b.jabatan_key]);c?await (0,d.execute)(`
        UPDATE ehb_panitia
        SET guru_id = ?, nama = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `,[b.guru_id??null,j,c,a]):f?await (0,d.execute)(`
        UPDATE ehb_panitia
        SET guru_id = ?, nama = ?, urutan = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `,[b.guru_id??null,j,e,f.id,a]):await (0,d.execute)(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
      `,[a,b.jabatan_key,b.guru_id??null,j,e])}else{if(!b.seksi_key)return{error:"Seksi wajib dipilih"};let e=b.peran??"anggota",f=c?void 0:await o(a,b.seksi_key);c?await (0,d.execute)(`
        UPDATE ehb_panitia
        SET peran = ?, guru_id = ?, nama = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `,[e,b.guru_id??null,j,c,a]):await (0,d.execute)(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
      `,[a,b.seksi_key,e,b.guru_id??null,j,f??1])}return(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/cetak"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(h),module:"ehb_kepanitiaan",action:c?"update":"create",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:c?"update":"create",entityType:"ehb_panitia",entityId:c?String(c):String(a),entityLabel:j,summary:`${c?"Memperbarui":"Menambahkan"} panitia ${j}`,details:{event_id:a,tipe:b.tipe,jabatan_key:b.jabatan_key??null,seksi_key:b.seksi_key??null,peran:b.peran??null}}),{success:!0}}async function q(a,b){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};await i();let h=b.map(a=>({...a,nama:a.nama.trim()})).filter(a=>a.nama);if(0===h.length)return{error:"Tidak ada data valid untuk diimpor"};let j=0;for(let b of h)if("inti"===b.tipe){if(!b.jabatan_key)continue;let c=x[b.jabatan_key]??99,e=await (0,d.queryOne)(`
        SELECT id FROM ehb_panitia
        WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = ?
        LIMIT 1
      `,[a,b.jabatan_key]);e?await (0,d.execute)(`
          UPDATE ehb_panitia
          SET guru_id = ?, nama = ?, urutan = ?, updated_at = datetime('now')
          WHERE id = ? AND ehb_event_id = ?
        `,[b.guru_id??null,b.nama,c,e.id,a]):await (0,d.execute)(`
          INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
          VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
        `,[a,b.jabatan_key,b.guru_id??null,b.nama,c]),j++}else{if(!b.seksi_key)continue;let c=await o(a,b.seksi_key);await (0,d.execute)(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
      `,[a,b.seksi_key,b.peran??"anggota",b.guru_id??null,b.nama,c]),j++}return(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/cetak"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"create",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"create",entityType:"ehb_panitia_batch",entityId:String(a),entityLabel:"Import panitia EHB",summary:`Import panitia EHB sebanyak ${j} orang`,details:{event_id:a,imported:j}}),{success:!0,imported:j}}async function r(a,b){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};await i();let h=b.map(a=>({...a,nama:a.nama.trim()})).filter(a=>a.nama);return await (0,d.execute)("DELETE FROM ehb_panitia WHERE ehb_event_id = ?",[a]),h.length>0&&await (0,d.batch)(h.map((b,c)=>"inti"===b.tipe?{sql:`
            INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
            VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
          `,params:[a,b.jabatan_key??null,b.guru_id??null,b.nama,b.jabatan_key?x[b.jabatan_key]??c+1:c+1]}:{sql:`
          INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
          VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
        `,params:[a,b.seksi_key??null,b.peran??"anggota",b.guru_id??null,b.nama,c+1]})),(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/cetak"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"update",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"update",entityType:"ehb_panitia_batch",entityId:String(a),entityLabel:"Replace panitia EHB",summary:`Mengganti susunan panitia EHB (${h.length} baris)`,details:{event_id:a,total_rows:h.length}}),{success:!0,saved:h.length}}async function s(a,b){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};if(await i(),a===b)return{error:"Event sumber tidak boleh sama dengan event aktif"};let h=await (0,d.query)(`
    SELECT id, ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ?
    ORDER BY CASE tipe WHEN 'inti' THEN 0 ELSE 1 END, urutan, nama
  `,[b]);return 0===h.length?{error:"Event sumber belum memiliki data panitia"}:(await (0,d.execute)("DELETE FROM ehb_panitia WHERE ehb_event_id = ?",[a]),await (0,d.batch)(h.map(b=>({sql:`
      INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,params:[a,b.tipe,b.jabatan_key,b.seksi_key,b.peran,b.guru_id,b.nama,b.urutan]}))),(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/cetak"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"update",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"update",entityType:"ehb_panitia_copy",entityId:String(a),entityLabel:"Copy panitia EHB",summary:`Menyalin panitia dari event ${b}`,details:{target_event_id:a,source_event_id:b,copied:h.length}}),{success:!0,copied:h.length})}async function t(a,b){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};let h=await (0,d.queryOne)("SELECT nama FROM ehb_panitia WHERE id = ? AND ehb_event_id = ?",[a,b]);return await (0,d.execute)("DELETE FROM ehb_panitia WHERE id = ? AND ehb_event_id = ?",[a,b]),(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/cetak"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"delete",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"delete",entityType:"ehb_panitia",entityId:String(a),entityLabel:h?.nama??`Panitia ${a}`,summary:`Menghapus panitia ${h?.nama??a}`}),{success:!0}}async function u(a,b){let c=await (0,e.getSession)();return c?(0===b.length||(await (0,d.batch)(b.map((b,c)=>({sql:"UPDATE ehb_panitia SET urutan = ?, updated_at = datetime('now') WHERE id = ? AND ehb_event_id = ?",params:[c+1,b,a]}))),(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"update",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"update",entityType:"ehb_panitia_order",entityId:String(a),entityLabel:"Urutan panitia EHB",summary:`Mengubah urutan ${b.length} panitia EHB`,details:{total_ids:b.length}})),{success:!0}):{error:"Unauthorized"}}async function v(a){return await i(),(0,d.query)(`
    WITH base AS (
      SELECT DISTINCT
        CASE WHEN m.nama LIKE '%Mutawassithah%' THEN 'kelas' ELSE 'marhalah' END as scope_type,
        CASE WHEN m.nama LIKE '%Mutawassithah%' THEN k.id ELSE CAST(m.id AS TEXT) END as scope_id,
        CASE WHEN m.nama LIKE '%Mutawassithah%' THEN k.nama_kelas ELSE m.nama END as scope_nama,
        m.id as marhalah_id,
        CASE WHEN m.nama LIKE '%Mutawassithah%' THEN k.id ELSE NULL END as kelas_id,
        m.urutan as marhalah_urutan,
        mp.id as mapel_id,
        mp.nama as mapel_nama
      FROM ehb_jadwal j
      JOIN mapel mp ON mp.id = j.mapel_id
      JOIN kelas k ON k.id = j.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE j.ehb_event_id = ?
    )
    SELECT
      b.scope_type,
      b.scope_id,
      b.scope_nama,
      b.marhalah_id,
      b.kelas_id,
      b.mapel_id,
      b.mapel_nama,
      ps.guru_id,
      COALESCE(dg.nama_lengkap, ps.nama_guru) as nama_guru
    FROM base b
    LEFT JOIN ehb_pembuat_soal_scope ps
      ON ps.ehb_event_id = ?
      AND ps.scope_type = b.scope_type
      AND ps.scope_id = b.scope_id
      AND ps.mapel_id = b.mapel_id
    LEFT JOIN data_guru dg ON dg.id = ps.guru_id
    ORDER BY b.marhalah_urutan, b.scope_nama, b.mapel_nama
  `,[a,a])}async function w(a,b){let c=await (0,e.getSession)();if(!c)return{error:"Unauthorized"};await i();let h=new Map;b.map(a=>({scope_type:a.scope_type,scope_id:a.scope_id.trim(),scope_nama:a.scope_nama.trim(),marhalah_id:a.marhalah_id?Number(a.marhalah_id):null,kelas_id:a.kelas_id?.trim()||null,mapel_id:Number(a.mapel_id),guru_id:a.guru_id?Number(a.guru_id):null,nama_guru:a.nama_guru?.trim()||null})).filter(a=>a.scope_id&&a.scope_nama&&a.mapel_id&&(a.guru_id||a.nama_guru)).forEach(a=>{h.set(`${a.scope_type}:${a.scope_id}:${a.mapel_id}`,a)});let j=Array.from(h.values());return await (0,d.execute)("DELETE FROM ehb_pembuat_soal_scope WHERE ehb_event_id = ?",[a]),j.length>0&&await (0,d.batch)(j.map(b=>({sql:`
        INSERT INTO ehb_pembuat_soal_scope
          (ehb_event_id, scope_type, scope_id, scope_nama, marhalah_id, kelas_id, mapel_id, guru_id, nama_guru)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,params:[a,b.scope_type,b.scope_id,b.scope_nama,b.marhalah_id,b.kelas_id,b.mapel_id,b.guru_id,b.nama_guru]}))),(0,g.revalidatePath)("/dashboard/ehb/kepanitiaan"),(0,g.revalidatePath)("/dashboard/ehb/keuangan"),await (0,f.logActivity)({actor:(0,f.actorFromSession)(c),module:"ehb_kepanitiaan",action:"update",fiturHref:"/dashboard/ehb/kepanitiaan",logKind:"update",entityType:"ehb_pembuat_soal_batch",entityId:String(a),entityLabel:"Pembuat soal EHB",summary:`Menyimpan ${j.length} pembuat soal EHB`,details:{event_id:a,total_rows:j.length}}),{success:!0,saved:j.length}}let x={ketua:1,wakil_ketua:2,sekretaris:3,wakil_sekretaris:4,bendahara:5,wakil_bendahara:6};(0,h.ensureServerEntryExports)([i,j,k,l,m,n,p,q,r,s,t,u,v,w]),(0,c.registerServerReference)(i,"00aceb28b87ba5af3702f0de1b31979162c8a10458",null),(0,c.registerServerReference)(j,"00d4aeb898468f45045a5719a6a90248ade408deae",null),(0,c.registerServerReference)(k,"00f10924fbc621043a67d018514fc99569dcc4365d",null),(0,c.registerServerReference)(l,"006c75cf93632fd0b404e3886d7bd3439f8cdcfd59",null),(0,c.registerServerReference)(m,"407b7e816dd256dd144da4d160483206851adf878e",null),(0,c.registerServerReference)(n,"40196e1911bac85607f011b4a63274c8f8881b7991",null),(0,c.registerServerReference)(p,"709ff775ec291f68acf1fd4962c4f994bdf2b3c996",null),(0,c.registerServerReference)(q,"607b7a02eff7a59b61d61859a17091f6f1d150f056",null),(0,c.registerServerReference)(r,"60dab0e6caf9d83c5c9273b5789ed1d95823ffc49b",null),(0,c.registerServerReference)(s,"60d819087d60ab8b41a0efab15a6a43f33e534fd08",null),(0,c.registerServerReference)(t,"600ff9ae82c3aadd62d72375ca8baca3a920f3341b",null),(0,c.registerServerReference)(u,"607c6d688eaf396a33d9979a6e3dd7261f92c83dc1",null),(0,c.registerServerReference)(v,"40c8022b81cd40c960f4b9ed6ff3919fb7fc82bc99",null),(0,c.registerServerReference)(w,"608e0771eb24d2ecbc4ee1c7bc8b53bfe09ed9af25",null),a.s([],66703),a.i(66703),a.s(["003144417e19712e947907ca31b6b39c8aa99a63df",()=>b.signOut,"006c75cf93632fd0b404e3886d7bd3439f8cdcfd59",()=>l,"00d4aeb898468f45045a5719a6a90248ade408deae",()=>j,"00f10924fbc621043a67d018514fc99569dcc4365d",()=>k,"40196e1911bac85607f011b4a63274c8f8881b7991",()=>n,"407b7e816dd256dd144da4d160483206851adf878e",()=>m,"40c8022b81cd40c960f4b9ed6ff3919fb7fc82bc99",()=>v,"607b7a02eff7a59b61d61859a17091f6f1d150f056",()=>q,"608e0771eb24d2ecbc4ee1c7bc8b53bfe09ed9af25",()=>w,"60d819087d60ab8b41a0efab15a6a43f33e534fd08",()=>s,"60dab0e6caf9d83c5c9273b5789ed1d95823ffc49b",()=>r],66223)}];

//# sourceMappingURL=_next-internal_server_app_dashboard_ehb_kepanitiaan_page_actions_f65fc011.js.map