"use strict";exports.id=8048,exports.ids=[8048],exports.modules={64327:(a,b,c)=>{c.d(b,{P:()=>e});var d=c(99829);let e=(0,d.createServerReference)("0013294cb5628438f2b87624d33081ed51ad40108c",d.callServer,void 0,d.findSourceMapURL,"getActiveEventLight")},79754:(a,b,c)=>{c.d(b,{AB:()=>y,Av:()=>n,Ct:()=>w,EG:()=>z,EK:()=>o,Hm:()=>v,Jl:()=>C,NT:()=>A,OE:()=>l,Od:()=>B,PD:()=>s,PN:()=>t,We:()=>k,ZJ:()=>q,mS:()=>r,o6:()=>x,tD:()=>p,tY:()=>m,vX:()=>i,xu:()=>j});var d=c(95349),e=c(44916),f=c(46100),g=c(89773),h=c(42650);async function i(a,b){return b?(0,e.P)(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id AND p.jam_group = ?) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `,[b,a]):(0,e.P)(`
        SELECT 
          r.*,
          (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as total_peserta
        FROM ehb_ruangan r
        WHERE r.ehb_event_id = ?
        ORDER BY r.nomor_ruangan
      `,[a])}async function j(a){return(0,e.P)("SELECT DISTINCT jam_group FROM ehb_kelas_jam WHERE ehb_event_id = ? ORDER BY jam_group",[a])}async function k(a,b){let c=await (0,f.Ht)();if(!c)return{error:"Unauthorized"};try{return await (0,e.g7)(`
      INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin)
      VALUES (?, ?, ?, ?, ?)
    `,[a,b.nomor_ruangan,b.nama_ruangan,b.kapasitas,b.jenis_kelamin]),await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_ruangan",entityLabel:b.nama_ruangan,summary:`Menambahkan ruangan ${b.nama_ruangan}`,details:{event_id:a,nomor_ruangan:b.nomor_ruangan,kapasitas:b.kapasitas,jenis_kelamin:b.jenis_kelamin}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Nomor ruangan sudah ada di event ini"};return{error:a.message}}}async function l(a,b,c,d,i){let j=await (0,f.Ht)();if(!j)return{error:"Unauthorized"};try{let f=[];for(let e=0;e<b;e++){let b=c+e;f.push({sql:"INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)",params:[a,b,`Ruang ${b}`,d,i]})}return await (0,e.vA)(f),await (0,g.Mx)({actor:(0,g.CF)(j),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Generate ruangan EHB",summary:`Menambahkan ${b} ruangan EHB`,details:{start_no:c,kapasitas:d,jenis_kelamin:i}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Gagal generate. Ada bentrok dengan nomor ruangan yang sudah ada."};return{error:a.message}}}async function m(a,b){let c=await (0,f.Ht)();if(!c)return{error:"Unauthorized"};try{let d=b.map(b=>({sql:`INSERT INTO ehb_ruangan (ehb_event_id, nomor_ruangan, nama_ruangan, kapasitas, jenis_kelamin) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ehb_event_id, nomor_ruangan) DO UPDATE SET 
            nama_ruangan = excluded.nama_ruangan, kapasitas = excluded.kapasitas, jenis_kelamin = excluded.jenis_kelamin`,params:[a,parseInt(b["Nomor Ruangan"]),b["Nama Ruangan"]||`Ruang ${b["Nomor Ruangan"]}`,parseInt(b.Kapasitas)||20,"P"===b["L/P"]||"Wanita"===b["L/P"]?"P":"L"]}));return await (0,e.vA)(d),await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Import ruangan EHB",summary:`Import ruangan EHB sebanyak ${b.length} baris`,details:{total_rows:b.length}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){return{error:a.message}}}async function n(a,b){let c=await (0,f.Ht)();if(!c)return{error:"Unauthorized"};try{return await (0,e.g7)(`
      UPDATE ehb_ruangan 
      SET nomor_ruangan = ?, nama_ruangan = ?, kapasitas = ?, jenis_kelamin = ?
      WHERE id = ?
    `,[b.nomor_ruangan,b.nama_ruangan,b.kapasitas,b.jenis_kelamin,a]),await (0,g.Mx)({actor:(0,g.CF)(c),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_ruangan",entityId:String(a),entityLabel:b.nama_ruangan,summary:`Memperbarui ruangan ${b.nama_ruangan}`,details:{nomor_ruangan:b.nomor_ruangan,kapasitas:b.kapasitas,jenis_kelamin:b.jenis_kelamin}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}}catch(a){if(a.message?.includes("UNIQUE"))return{error:"Nomor ruangan sudah dipakai"};return{error:a.message}}}async function o(a){let b=await (0,f.Ht)();if(!b)return{error:"Unauthorized"};let c=await (0,e.Zy)("SELECT nama_ruangan, nomor_ruangan FROM ehb_ruangan WHERE id = ?",[a]);if(!c)return{error:"Ruangan tidak ditemukan atau sudah terhapus."};let d=c.nama_ruangan?.trim()||`Ruangan ${c.nomor_ruangan??a}`,i=await (0,e.Zy)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ruangan_id = ?",[a]);if(i&&i.total>0)return{error:`${d} tidak bisa dihapus karena masih berisi ${i.total} peserta. Keluarkan dulu peserta dari ruangan ini atau kosongkan dari menu Plotting Ruangan.`};let j=await (0,e.Zy)("SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ruangan_id = ?",[a]);await (0,e.g7)("DELETE FROM ehb_jadwal_pengawas WHERE ruangan_id = ?",[a]);try{await (0,e.g7)("DELETE FROM ehb_ruangan WHERE id = ?",[a])}catch(b){let a=String(b?.message||"");if(a.includes("FOREIGN KEY"))return{error:`${d} belum bisa dihapus karena masih dipakai data lain. Cek lagi plotting, absensi, atau jadwal yang masih terkait.`};return{error:`Gagal menghapus ${d}: ${a||"terjadi kesalahan sistem."}`}}return await (0,g.Mx)({actor:(0,g.CF)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_ruangan",entityId:String(a),entityLabel:d,summary:`Menghapus ruangan ${d}`,details:{removed_jadwal_pengawas:j?.total||0}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),(0,h.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0}}async function p(a){let b=await (0,f.Ht)();if(!b)return{error:"Unauthorized"};let c=await (0,e.Zy)("SELECT COUNT(*) as total FROM ehb_ruangan WHERE ehb_event_id = ?",[a]);return c&&0!==c.total?(await (0,e.g7)("DELETE FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a]),await (0,e.g7)("DELETE FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]),await (0,e.g7)("DELETE FROM ehb_ruangan WHERE ehb_event_id = ?",[a]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_ruangan_batch",entityId:String(a),entityLabel:"Reset ruangan EHB",summary:"Menghapus semua ruangan EHB",details:{total_ruangan:c.total,reset_plotting:!0,reset_jadwal_pengawas:!0}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),(0,h.revalidatePath)("/dashboard/ehb/ruangan/plotting"),(0,h.revalidatePath)("/dashboard/ehb/pengawas"),(0,h.revalidatePath)("/dashboard/ehb/pengawas/plotting"),{success:!0,deleted:c.total}):{error:"Belum ada ruangan yang bisa dihapus."}}async function q(a){let[b,c,d]=await Promise.all([(0,e.Zy)("SELECT COUNT(*) as total FROM ehb_ruangan WHERE ehb_event_id = ?",[a]),(0,e.Zy)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ehb_event_id = ?",[a]),(0,e.Zy)("SELECT COUNT(*) as total FROM ehb_jadwal_pengawas WHERE ehb_event_id = ?",[a])]);return{totalRuangan:b?.total||0,totalPlotting:c?.total||0,totalJadwalPengawas:d?.total||0}}async function r(a){let b=await (0,e.Zy)("SELECT * FROM ehb_ruangan WHERE id = ?",[a]);return b?{ruangan:b,peserta:await (0,e.P)(`
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
  `,[a])}:null}async function s(){return(0,e.Zy)("SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1")}async function t(a,b,c){return(0,e.P)(`
    SELECT id, nomor_ruangan, nama_ruangan, kapasitas,
      (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id) as terisi
    FROM ehb_ruangan r
    WHERE r.ehb_event_id = ? AND r.id != ? AND r.jenis_kelamin = ?
    ORDER BY r.nomor_ruangan
  `,[a,b,c])}async function u(a,b){let c=await (0,e.Zy)("SELECT id, kapasitas FROM ehb_ruangan WHERE id = ?",[a]);if(!c)return{error:"Ruangan tujuan tidak ditemukan."};let d=new Set((await (0,e.P)("SELECT nomor_kursi FROM ehb_plotting_santri WHERE ruangan_id = ? AND jam_group = ? ORDER BY nomor_kursi",[a,b])).map(a=>Number(a.nomor_kursi)));for(let a=1;a<=Number(c.kapasitas||0);a++)if(!d.has(a))return{seat:a};return{error:"Ruangan tujuan sudah penuh untuk jam group ini."}}async function v(a,b,c,d){return(0,e.P)(`
    SELECT id, nomor_ruangan, nama_ruangan, kapasitas,
      (SELECT COUNT(*) FROM ehb_plotting_santri p WHERE p.ruangan_id = r.id AND p.jam_group = ?) as terisi
    FROM ehb_ruangan r
    WHERE r.ehb_event_id = ? AND r.id != ? AND r.jenis_kelamin = ?
    ORDER BY r.nomor_ruangan
  `,[d,a,b,c])}async function w(a,b,c,d){let i=await (0,f.Ht)();if(!i)return{error:"Unauthorized"};let j=await u(c,d);return"error"in j?{error:j.error}:(await (0,e.g7)(`
        UPDATE ehb_plotting_santri
        SET ruangan_id = ?, nomor_kursi = ?, jam_group = ?
        WHERE santri_id = ? AND ehb_event_id = ?
    `,[c,j.seat,d,a,b]),await (0,g.Mx)({actor:(0,g.CF)(i),module:"ehb_ruangan",action:"update",fiturHref:"/dashboard/ehb/ruangan",logKind:"update",entityType:"ehb_plotting_santri",entityId:`${b}:${a}`,entityLabel:"Pindah peserta EHB",summary:"Memindahkan peserta EHB ke ruangan baru",details:{santri_id:a,target_ruangan_id:c,jam_group:d}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0})}async function x(a){let b=await (0,f.Ht)();return b?(await (0,e.g7)("DELETE FROM ehb_plotting_santri WHERE id = ?",[a]),await (0,g.Mx)({actor:(0,g.CF)(b),module:"ehb_ruangan",action:"delete",fiturHref:"/dashboard/ehb/ruangan",logKind:"delete",entityType:"ehb_plotting_santri",entityId:String(a),entityLabel:"Peserta ruangan EHB",summary:"Menghapus peserta dari ruangan EHB"}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0}):{error:"Unauthorized"}}async function y(a,b,c,d){return(0,e.P)(`
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
    `,[a,d,b,`%${c}%`,a])}async function z(a,b,c,d){let i=await (0,f.Ht)();if(!i)return{error:"Unauthorized"};let j=await (0,e.Zy)("SELECT COUNT(*) as total FROM ehb_plotting_santri WHERE ehb_event_id = ? AND santri_id = ?",[a,c]);if((j?.total||0)>0)return{error:"Santri ini sudah terplot di event EHB ini."};let k=await u(b,d);return"error"in k?{error:k.error}:(await (0,e.g7)(`
        INSERT INTO ehb_plotting_santri (ehb_event_id, ruangan_id, santri_id, nomor_kursi, jam_group)
        VALUES (?, ?, ?, ?, ?)
    `,[a,b,c,k.seat,d]),await (0,g.Mx)({actor:(0,g.CF)(i),module:"ehb_ruangan",action:"create",fiturHref:"/dashboard/ehb/ruangan",logKind:"create",entityType:"ehb_plotting_santri",entityId:`${a}:${c}`,entityLabel:"Peserta ruangan EHB",summary:"Menambahkan peserta manual ke ruangan EHB",details:{ruangan_id:b,santri_id:c,jam_group:d}}),(0,h.revalidatePath)("/dashboard/ehb/ruangan"),{success:!0})}async function A(a){let{ruangan:b,peserta:c}=await r(a)||{};if(!b)return null;let d={};return c&&c.forEach(a=>{d[a.jam_group]||(d[a.jam_group]=[]),d[a.jam_group].push({no_kursi:a.nomor_kursi,no_peserta:`${String(b.nomor_ruangan).padStart(2,"0")}-${String(a.nomor_kursi).padStart(2,"0")}`,nama:a.nama_lengkap,kelas:a.nama_kelas,marhalah:a.marhalah_nama})}),{ruangan:b,peserta:d}}async function B(a){return(0,e.P)("SELECT id, nomor_sesi, label, jam_group FROM ehb_sesi WHERE ehb_event_id = ? ORDER BY nomor_sesi",[a])}async function C(a,b){let c=await (0,e.Zy)("SELECT * FROM ehb_ruangan WHERE id = ?",[a]);if(!c)return null;let d=await (0,e.Zy)("SELECT * FROM ehb_sesi WHERE id = ?",[b]);if(!d)return null;let f=await (0,e.P)(`
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
    `,[a,d.jam_group]),g=await (0,e.P)(`
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
    `,[b,a,d.jam_group]),h={};g.forEach(a=>{h[a.kelas_id]||(h[a.kelas_id]=[]),h[a.kelas_id].push(a.mapel_nama)});let i=f.map(a=>({no_kursi:a.nomor_kursi,no_peserta:`${String(c.nomor_ruangan).padStart(2,"0")}-${String(a.nomor_kursi).padStart(2,"0")}`,nama:a.nama_lengkap,asrama_kamar:`${(a.asrama||"").substring(0,3).toUpperCase()}/${a.kamar||"-"}`,kelas:a.nama_kelas,mapel:h[a.kelas_id]||[]})),j=0;return Object.values(h).forEach(a=>{a.length>j&&(j=a.length)}),{ruangan:c,sesi:d,peserta:i,maxMapel:j}}(0,c(89337).D)([i,j,k,l,m,n,o,p,q,r,s,t,v,w,x,y,z,A,B,C]),(0,d.A)(i,"608123d8469dc9dad998a0f6218c62b91375985c41",null),(0,d.A)(j,"40e0e5323ef8ea7fd049e1ccd99d51b35cb588d5eb",null),(0,d.A)(k,"60467daac957680bc67b385d6ae4f72908fe0a958f",null),(0,d.A)(l,"7c8562f9652b6eeaab504da65926524754af865f4e",null),(0,d.A)(m,"6067fe072e4802709199cd4386901aada2167299c7",null),(0,d.A)(n,"608db1e54fe39e1a45f411ceeda07c7582d958d118",null),(0,d.A)(o,"404656673c733e91f3c6896bdf15c288ab73120eba",null),(0,d.A)(p,"403844bd0d810237b55f5477a3c004f93d81043587",null),(0,d.A)(q,"407237dc2b52b4f92f86fa39624feac60564844c1a",null),(0,d.A)(r,"40eb8cbf317bf9f0b3785887d492f1aaa21f487901",null),(0,d.A)(s,"0013294cb5628438f2b87624d33081ed51ad40108c",null),(0,d.A)(t,"70a9d3e9d359ed665525d641c1d082aa8411047a46",null),(0,d.A)(v,"783403e8ccbd5edee4064ee3d35716d7041b424dab",null),(0,d.A)(w,"781d912c64fd28821ff06bb1fa7ff928e5493c9c4a",null),(0,d.A)(x,"4014715cbe6c3e0ea010dc2f020571deac3e0f419b",null),(0,d.A)(y,"78afab6d287876583a9db44d511481eb535f310e79",null),(0,d.A)(z,"789d84b24d42a451af2d62fff6e53780ff43a5f992",null),(0,d.A)(A,"40cb0aab1d75126a645e72fb1a88f0734b4ad2e3db",null),(0,d.A)(B,"40226762a57552a82e7c23a9cf5b662f9bb3faa2e9",null),(0,d.A)(C,"60558701e7d18cf87680273e4eb4a75e2acb84061a",null)}};