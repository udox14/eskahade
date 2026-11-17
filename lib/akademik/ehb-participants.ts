// Match eligibility for room plotting, without depending on assigned seats.
// Bind the event ID once. The same roster feeds all EHB budget estimates.
export const ehbParticipantsCte = `
  ehb_participants AS (
    SELECT DISTINCT rp.santri_id, kj.kelas_id
    FROM ehb_kelas_jam kj
    JOIN ehb_event e ON e.id = kj.ehb_event_id
    JOIN kelas k ON k.id = kj.kelas_id AND k.tahun_ajaran_id = e.tahun_ajaran_id
    JOIN marhalah m ON m.id = k.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    JOIN santri s ON s.id = rp.santri_id
    WHERE kj.ehb_event_id = ?
      AND (s.status_global = 'aktif' OR (s.status_global = 'nonaktif_sementara' AND s.kelas_sekolah = '9'))
      AND m.nama NOT LIKE '%Mutaqaddimah%'
  )
`
