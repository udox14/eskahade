module.exports=[50138,a=>{"use strict";var b=a.i(37936),c=a.i(12259),d=a.i(53058),e=a.i(6846),f=a.i(18558);async function g(a,b){return b?(0,c.query)(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id AND p.jam_group = ?) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `,[b,a]):(0,c.query)(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `,[a])}async function h(a){return(0,c.query)("SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ? ORDER BY jam_group",[a])}async function i(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};try{return await (0,c.execute)(`
      INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin)
      VALUES (?, ?, ?, ?, ?)
    `,[a,b.nomor_ruangan,b.nama_ruangan,b.kapasitas,b.jenis_kelamin]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_ruangan",entityLabel:b.nama_ruangan,summary:`Menambahkan ruangan ${b.nama_ruangan}`,details:{event_id:a,nomor_ruangan:b.nomor_ruangan,kapasitas:b.kapasitas,jenis_kelamin:b.jenis_kelamin}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Nomor ruangan sudah ada di event ini"};return{error:a.message}}}async function j(a,b,g,h,i){let j=await (0,d.getSession)();if(!j)return{error:"Unauthorized"};try{let d=[];for(let c=0;c<b;c++){let b=g+c;d.push({sql:"INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)",params:[a,b,`Ruang ${b}`,h,i]})}return await (0,c.batch)(d),await (0,e.logActivity)({actor:(0,e.actorFromSession)(j),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Generate ruangan EHB",summary:`Menambahkan ${b} ruangan EHB`,details:{start_no:g,kapasitas:h,jenis_kelamin:i}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Gagal generate. Ada bentrok dengan nomor ruangan yang sudah ada."};return{error:a.message}}}async function k(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};try{let d=b.map(b=>({sql:`INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ehb_event_id, nomor_ruangan) DO UPDATE SET 
            nama_ruangan = excluded.nama_ruangan, kapasitas = excluded.kapasitas, jenis_kelamin = excluded.jenis_kelamin`,params:[a,parseInt(b["Nomor Ruangan"]),b["Nama Ruangan"]||`Ruang ${b["Nomor Ruangan"]}`,parseInt(b.Kapasitas)||20,"P"===b["L/P"]||"Wanita"===b["L/P"]?"P":"L"]}));return await (0,c.batch)(d),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Import ruangan EHB",summary:`Import ruangan EHB sebanyak ${b.length} baris`,details:{total_rows:b.length}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){return{error:a.message}}}async function l(a,b){let g=await (0,d.getSession)();if(!g)return{error:"Unauthorized"};try{return await (0,c.execute)(`
      UPDATE ehb_ruangan 
      SET nomor_ruangan = ?, nama_ruangan = ?, kapasitas = ?, jenis_kelamin = ?
      WHERE id = ?
    `,[b.nomor_ruangan,b.nama_ruangan,b.kapasitas,b.jenis_kelamin,a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(g),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_ruangan",entityId:String(a),entityLabel:b.nama_ruangan,summary:`Memperbarui ruangan ${b.nama_ruangan}`,details:{nomor_ruangan:b.nomor_ruangan,kapasitas:b.kapasitas,jenis_kelamin:b.jenis_kelamin}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Nomor ruangan sudah dipakai"};return{error:a.message}}}async function m(a){let b=await (0,d.getSession)();if(!b)return{error:"Unauthorized"};let g=await (0,c.queryOne)("SELECT nama_ruangan, nomor_ruangan FROM ehb_ruangan WHERE id = ?",[a]);if(!g)return{error:"Ruangan tidak ditemukan atau sudah terhapus."};let h=g.nama_ruangan?.trim()||`Ruangan ${g.nomor_ruangan??a}`,i=await (0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ruangan_id = ?",[a]);if(i&&i.total>0)return{error:`${h} tidak bisa dihapus karena masih berisi ${i.total} peserta. Keluarkan dulu peserta dari ruangan ini atau kosongkan dari menu Plotting Ruangan.`};let j=await (0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ruangan_id = ?",[a]);await (0,c.execute)("DELETE FROM ehb_jadwal_pengawas WHERE ruangan_id = ?",[a]);try{await (0,c.execute)("DELETE FROM ehb_ruangan WHERE id = ?",[a])}catch(b){let a=String(b?.message||"");if(a.includes("FOREIGN KEY"))return{error:`${h} belum bisa dihapus karena masih dipakai data lain. Cek lagi plotting, absensi, atau jadwal yang masih terkait.`};return{error:`Gagal menghapus ${h}: ${a||"terjadi kesalahan sistem."}`}}return await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_ruangan",entityId:String(a),entityLabel:h,summary:`Menghapus ruangan ${h}`,details:{removed_jadwal_pengawas:j?.total||0}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),(0,f.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0}}async function n(a){let b=await (0,d.getSession)();if(!b)return{error:"Unauthorized"};let g=await (0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_ruangan WHERE ehb_event_id = ?",[a]);return g&&0!==g.total?(await (0,c.execute)("DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a]),await (0,c.execute)("DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]),await (0,c.execute)("DELETE FROM ehb_ruangan WHERE ehb_event_id = ?",[a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Reset ruangan EHB",summary:"Menghapus semua ruangan EHB",details:{total_ruangan:g.total,reset_plotting:!0,reset_jadwal_pengawas:!0}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),(0,f.revalidatePath)("/dashboard/ehb/ruangan/plotting"),(0,f.revalidatePath)("/dashboard/ehb/pengawas"),(0,f.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0,deleted:g.total}):{error:"Belum ada ruangan yang bisa dihapus."}}async function o(a){let[b,d,e]=await Promise.all([(0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_ruangan WHERE ehb_event_id = ?",[a]),(0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]),(0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a])]);return{totalRuangan:b?.total||0,totalPlotting:d?.total||0,totalJadwalPengawas:e?.total||0}}async function p(a){let b=await (0,c.queryOne)("SELECT * FROM ehb_ruangan WHERE id = ?",[a]);return b?{ruangan:b,peserta:await (0,c.query)(`
    SELECT 
      p.*, 
      s.nama_lengkap, s.nis, s.kelas_sekolah, s.asrama, s.kamar,
      k.nama_kelas, m.nama AS marhalah_nama
    FROM ehb_plotting_santri p
    JOIN santri s ON s.id = p.santri_id
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE p.ruangan_id = ?
    ORDER BY p.jam_group, p.nomor_kursi
  `,[a])}:null}async function q(){return(0,c.queryOne)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function r(a,b,d){return(0,c.query)(`
    SELECT id, nomor_ruangan, nama_ruangan, kapasitas,
      (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as terisi
    FROM ehb_ruangan r
    WHERE r.ehb_event_id = ? AND r.id != ? AND r.jenis_kelamin = ?
    ORDER BY r.nomor_ruangan
  `,[a,b,d])}async function s(a,b){let d=await (0,c.queryOne)("SELECT id, kapasitas FROM ehb_ruangan WHERE id = ?",[a]);if(!d)return{error:"Ruangan tujuan tidak ditemukan."};let e=new Set((await (0,c.query)("SELECT nomor_kursi FROM ehb_plotting_santri WHERE ruangan_id = ? AND jam_group = ? ORDER BY nomor_kursi",[a,b])).map(a=>Number(a.nomor_kursi)));for(let a=1;a<=Number(d.kapasitas||0);a++)if(!e.has(a))return{seat:a};return{error:"Ruangan tujuan sudah penuh untuk jam group ini."}}async function t(a,b,d,e){return(0,c.query)(`
    SELECT id, nomor_ruangan, nama_ruangan, kapasitas,
      (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id AND p.jam_group = ?) as terisi
    FROM ehb_ruangan r
    WHERE r.ehb_event_id = ? AND r.id != ? AND r.jenis_kelamin = ?
    ORDER BY r.nomor_ruangan
  `,[e,a,b,d])}async function u(a,b,g,h){let i=await (0,d.getSession)();if(!i)return{error:"Unauthorized"};let j=await s(g,h);return"error"in j?{error:j.error}:(await (0,c.execute)(`
        UPDATE ehb_plotting_santri
        SET ruangan_id = ?, nomor_kursi = ?, jam_group = ?
        WHERE santri_id = ? AND ehb_event_id = ?
    `,[g,j.seat,h,a,b]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(i),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_plotting_santri",entityId:`${b}:${a}`,entityLabel:"Pindah peserta EHB",summary:"Memindahkan peserta EHB ke ruangan baru",details:{santri_id:a,target_ruangan_id:g,jam_group:h}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0})}async function v(a){let b=await (0,d.getSession)();return b?(await (0,c.execute)("DELETE FROM ehb_plotting_santri WHERE id = ?",[a]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_plotting_santri",entityId:String(a),entityLabel:"Peserta ruangan EHB",summary:"Menghapus peserta dari ruangan EHB"}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}):{error:"Unauthorized"}}async function w(a,b,d,e){return(0,c.query)(`
        SELECT s.id, s.nama_lengkap, s.nis, k.nama_kelas
        FROM santri s
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        JOIN ehb_kelas_jam kj ON kj.kelas_id = rp.kelas_id AND kj.ehb_event_id = ? AND kj.jam_group = ?
        WHERE (
            s.status_global = 'aktif'
            OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9')
          )
          AND s.jenis_kelamin = ? 
          AND s.nama_lengkap LIKE ?
          AND s.id NOT IN (SELECT santri_id FROM ehb_plotting_santri WHERE ehb_event_id = ?)
        LIMIT 10
    `,[a,e,b,`%${d}%`,a])}async function x(a,b,g,h){let i=await (0,d.getSession)();if(!i)return{error:"Unauthorized"};let j=await (0,c.queryOne)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ehb_event_id = ? AND santri_id = ?",[a,g]);if((j?.total||0)>0)return{error:"Santri ini sudah terplot di event EHB ini."};let k=await s(b,h);return"error"in k?{error:k.error}:(await (0,c.execute)(`
        INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group)
        VALUES (?, ?, ?, ?, ?)
    `,[a,b,g,k.seat,h]),await (0,e.logActivity)({actor:(0,e.actorFromSession)(i),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_plotting_santri",entityId:`${a}:${g}`,entityLabel:"Peserta ruangan EHB",summary:"Menambahkan peserta manual ke ruangan EHB",details:{ruangan_id:b,santri_id:g,jam_group:h}}),(0,f.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0})}async function y(a){let{ruangan:b,peserta:c}=await p(a)||{};if(!b)return null;let d={};return c&&c.forEach(a=>{d[a.jam_group]||(d[a.jam_group]=[]),d[a.jam_group].push({no_kursi:a.nomor_kursi,no_peserta:`${String(b.nomor_ruangan).padStart(2,"0")}-${String(a.nomor_kursi).padStart(2,"0")}`,nama:a.nama_lengkap,kelas:a.nama_kelas,marhalah:a.marhalah_nama})}),{ruangan:b,peserta:d}}async function z(a){return(0,c.query)("SELECT id, nomor_sesi, label, jam_group FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi",[a])}async function A(a,b){let d=await (0,c.queryOne)("SELECT * FROM ehb_ruangan WHERE id = ?",[a]);if(!d)return null;let e=await (0,c.queryOne)("SELECT * FROM ehb_sesi WHERE id = ?",[b]);if(!e)return null;let f=await (0,c.query)(`
        SELECT 
            p.nomor_kursi,
            s.nama_lengkap, s.asrama, s.kamar,
            k.id as kelas_id, k.nama_kelas
        FROM ehb_plotting_santri p
        JOIN santri s ON s.id = p.santri_id
        JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE p.ruangan_id = ? AND p.jam_group = ?
        ORDER BY p.nomor_kursi
    `,[a,e.jam_group]),g=await (0,c.query)(`
        SELECT j.kelas_id, j.tanggal, m.nama as mapel_nama
        FROM ehb_jadwal j
        JOIN mapel m ON m.id = j.mapel_id
        WHERE j.sesi_id = ? AND j.kelas_id IN (
            SELECT DISTINCT k.id
            FROM ehb_plotting_santri p
            JOIN riwayat_pendidikan rp ON rp.santri_id = p.santri_id AND rp.status_riwayat = 'aktif'
            JOIN kelas k ON k.id = rp.kelas_id
            WHERE p.ruangan_id = ? AND p.jam_group = ?
        )
        ORDER BY j.tanggal
    `,[b,a,e.jam_group]),h={};g.forEach(a=>{h[a.kelas_id]||(h[a.kelas_id]=[]),h[a.kelas_id].push(a.mapel_nama)});let i=f.map(a=>({no_kursi:a.nomor_kursi,no_peserta:`${String(d.nomor_ruangan).padStart(2,"0")}-${String(a.nomor_kursi).padStart(2,"0")}`,nama:a.nama_lengkap,asrama_kamar:`${(a.asrama||"").substring(0,3).toUpperCase()}/${a.kamar||"-"}`,kelas:a.nama_kelas,mapel:h[a.kelas_id]||[]})),j=0;return Object.values(h).forEach(a=>{a.length>j&&(j=a.length)}),{ruangan:d,sesi:e,peserta:i,maxMapel:j}}(0,a.i(13095).ensureServerEntryExports)([g,h,i,j,k,l,m,n,o,p,q,r,t,u,v,w,x,y,z,A]),(0,b.registerServerReference)(g,"600042aa88358abf9ea55cb108b6db9c7bcf306bbe",null),(0,b.registerServerReference)(h,"400e2fe4d3478b99ed9fdc8622c5d9774588a6ae9f",null),(0,b.registerServerReference)(i,"60b7252ff2e6f6eb9994005646924731399f601972",null),(0,b.registerServerReference)(j,"7c6e0944eae2eeb64378014a9b7c10e9607db38b74",null),(0,b.registerServerReference)(k,"60b60d3787fff5c595b16244236ded57e83d524a77",null),(0,b.registerServerReference)(l,"60ff3c244e9b47e8f301dd98cd58b3f2b56d2313b5",null),(0,b.registerServerReference)(m,"40c233ad859cb477d55e176b0c044fb85efc63738b",null),(0,b.registerServerReference)(n,"40f35906c19a0efeca9431af77d872faca53d2a874",null),(0,b.registerServerReference)(o,"40262cb7f6ff7859653ccebfc176060861c2e23a35",null),(0,b.registerServerReference)(p,"406d7e99087729da4539cfeca6a5e15eaf6375a907",null),(0,b.registerServerReference)(q,"00cfff6f15bab62302ac30dfafb57c9c8656dc7314",null),(0,b.registerServerReference)(r,"70e0169f15391c4ac21528d1b7a9babc3159f40475",null),(0,b.registerServerReference)(t,"78b5884b595e616c4ee77e75804bc0dc135004607f",null),(0,b.registerServerReference)(u,"78c2ca2a5e73d453492b7fe7685c66a8e01362aa72",null),(0,b.registerServerReference)(v,"403498a67eba1d17e17b119097d1ca922b22dda3a2",null),(0,b.registerServerReference)(w,"781f1a04ee459f64fec6910669254432fe72736e49",null),(0,b.registerServerReference)(x,"78908c9ddfa7a9fb0760b613093826fb101e09bab7",null),(0,b.registerServerReference)(y,"405b3e9bfe5e4c66e39abcb4d4aeb6ca6489d13889",null),(0,b.registerServerReference)(z,"40eef25108ed12d33d21aef73b10212e27a241f01c",null),(0,b.registerServerReference)(A,"604a5fc5b2cad90cd9170331b0337ba2fbab00d26b",null),a.s(["addRuangan",()=>i,"addRuanganBulk",()=>j,"addRuanganImport",()=>k,"cariSantriUnplotted",()=>w,"deleteAllRuangan",()=>n,"deleteRuangan",()=>m,"getActiveEventLight",()=>q,"getDeleteAllRuanganImpact",()=>o,"getJamGroups",()=>h,"getOtherRuanganByJamGroup",()=>t,"getRuanganDetail",()=>p,"getRuanganList",()=>g,"hapusPeserta",()=>v,"pindahSantri",()=>u,"tambahPesertaManual",()=>x,"updateRuangan",()=>l])}];

//# sourceMappingURL=app_dashboard_ehb_ruangan_actions_ts_1b176c88._.js.map