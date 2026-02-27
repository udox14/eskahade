'use server'

import { createClient } from '@/lib/supabase/server'

export async function getJuaraUmum(semester: number) {
  const supabase = await createClient()

  // 1. Ambil SEMUA Kelas yang aktif di database + Nama Wali Kelas
  const { data: allKelas } = await supabase
    .from('kelas')
    .select(`
      id,
      nama_kelas,
      tahun_ajaran(nama),
      marhalah!inner (nama, urutan),
      wali_kelas:wali_kelas_id(full_name)
    `)

  // 2. Ambil data ranking (Hanya juara 1, 2, 3)
  const { data: rankingData } = await supabase
    .from('ranking')
    .select(`
      ranking_kelas,
      jumlah_nilai,
      rata_rata,
      riwayat_pendidikan!inner (
        kelas_id,
        santri!inner (nama_lengkap, nis, asrama, kamar)
      )
    `)
    .eq('semester', semester)
    .lte('ranking_kelas', 3)

  // 3. Format dan Urutkan Kelas (Natural Sort)
  const formattedKelas = (allKelas || []).map((k: any) => {
    const marhalah = Array.isArray(k.marhalah) ? k.marhalah[0] : k.marhalah;
    const ta = k.tahun_ajaran ? (Array.isArray(k.tahun_ajaran) ? k.tahun_ajaran[0]?.nama : k.tahun_ajaran?.nama) : null;
    const wali = k.wali_kelas ? (Array.isArray(k.wali_kelas) ? k.wali_kelas[0]?.full_name : k.wali_kelas?.full_name) : null;
    
    return {
      kelas_id: k.id,
      kelas_nama: k.nama_kelas,
      tahun_ajaran: ta,
      marhalah_nama: marhalah.nama,
      marhalah_urutan: marhalah.urutan,
      wali_kelas: wali || '-'
    }
  })

  formattedKelas.sort((a, b) => {
    if (a.marhalah_urutan !== b.marhalah_urutan) return a.marhalah_urutan - b.marhalah_urutan;
    return a.kelas_nama.localeCompare(b.kelas_nama, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 4. Gabungkan Data (Paksakan 3 Baris per Kelas)
  const result: any[] = []

  formattedKelas.forEach(kelas => {
    // Cari data ranking untuk kelas ini
    const ranksForClass = (rankingData || []).filter((r:any) => {
      const rp = Array.isArray(r.riwayat_pendidikan) ? r.riwayat_pendidikan[0] : r.riwayat_pendidikan;
      return rp.kelas_id === kelas.kelas_id;
    })

    // Selalu hasilkan Juara 1, 2, dan 3 (Jika kosong, tampilkan baris kosong)
    for (let i = 1; i <= 3; i++) {
      const foundRank = ranksForClass.find(r => r.ranking_kelas === i);
      if (foundRank) {
        const rp = Array.isArray(foundRank.riwayat_pendidikan) ? foundRank.riwayat_pendidikan[0] : foundRank.riwayat_pendidikan;
        const santri = Array.isArray(rp.santri) ? rp.santri[0] : rp.santri;
        result.push({
          rank: i,
          jumlah: foundRank.jumlah_nilai,
          rata: foundRank.rata_rata,
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: santri.nama_lengkap,
          nis: santri.nis,
          asrama: santri.asrama || '',
          kamar: santri.kamar || ''
        })
      } else {
        // Data Kosong (Tetap dicetak sebagai placeholder)
        result.push({
          rank: i,
          jumlah: '',
          rata: '',
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: '', 
          nis: '',
          asrama: '',
          kamar: ''
        })
      }
    }
  });

  return result;
}