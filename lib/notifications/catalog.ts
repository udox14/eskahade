// Katalog jenis notifikasi. Default redaksi & penerima hidup di kode; admin hanya
// menyimpan override di notif_event_types (lihat config.ts).
//
// Placeholder ditulis {nama}. Nilai mentah dikirim lewat payload outbox; format
// (Rupiah, tanggal WIB) dilakukan server saat render — nominal tetap integer.

import type { NotifEventDefinition, PlaceholderDef, StaffRecipientRule } from './types'

export const NOTIF_CATEGORIES: Record<string, string> = {
  tagihan: 'Tagihan',
  pembayaran: 'Pembayaran',
  uang_jajan: 'Uang Jajan',
  verifikasi_keuangan: 'Verifikasi Keuangan',
  kontrol_keuangan: 'Kontrol Keuangan',
  perizinan: 'Perizinan',
  setoran: 'Setoran SPP',
  kesantrian: 'Kesantrian',
  pengumuman: 'Pengumuman',
}

export const NOTIF_MODULES: Record<string, string> = {
  keuangan: 'Sistem Keuangan',
  koperasi: 'Koperasi',
  keamanan: 'Keamanan & Perizinan',
  asrama: 'Asrama',
  santri: 'Data Santri',
}

const P = {
  namaSantri: { key: 'nama_santri', label: 'Nama santri', format: 'text', sample: 'Ahmad Fauzi' },
  asrama: { key: 'asrama', label: 'Asrama', format: 'text', sample: 'AL-FALAH' },
  nominal: { key: 'nominal', label: 'Nominal', format: 'rupiah', sensitive: true, sample: 1250000 },
  saldo: { key: 'saldo', label: 'Saldo setelah transaksi', format: 'rupiah', sensitive: true, sample: 175000 },
  total: { key: 'total', label: 'Total', format: 'rupiah', sensitive: true, sample: 850000 },
  selisih: { key: 'selisih', label: 'Selisih', format: 'rupiah', sensitive: true, sample: 15000 },
  nomor: { key: 'nomor', label: 'Nomor transaksi', format: 'text', sample: 'TRF-20261123-0042' },
  metode: { key: 'metode', label: 'Metode bayar', format: 'text', sample: 'BRIVA' },
  periode: { key: 'periode', label: 'Periode', format: 'text', sample: 'Desember 2026' },
  jumlah: { key: 'jumlah', label: 'Jumlah item', format: 'text', sample: 3 },
  alasan: { key: 'alasan', label: 'Alasan/catatan petugas', format: 'text', sensitive: true, sample: 'Bukti transfer buram' },
  waktu: { key: 'waktu', label: 'Waktu', format: 'datetime', sample: '2026-11-23T03:15:00.000Z' },
  batasWaktu: { key: 'batas_waktu', label: 'Batas waktu', format: 'datetime', sample: '2026-11-24T03:15:00.000Z' },
  perwakilan: { key: 'perwakilan', label: 'Nama perwakilan', format: 'text', sample: 'Ust. Hasan (Kamar 12)' },
  petugas: { key: 'petugas', label: 'Nama petugas', format: 'text', sample: 'Siti Aminah' },
  jenis: { key: 'jenis', label: 'Jenis', format: 'text', sample: 'Transfer belum teralokasi' },
  keputusan: { key: 'keputusan', label: 'Keputusan', format: 'text', sample: 'disetujui' },
  keperluan: { key: 'keperluan', label: 'Keperluan', format: 'text', sample: 'izin pulang (acara keluarga)' },
  pihak: { key: 'pihak', label: 'Pihak yang mengonfirmasi', format: 'text', sample: 'Bendahara Pesantren' },
  catatan: { key: 'catatan', label: 'Catatan keputusan', format: 'text', sample: 'tidak ada' },
} satisfies Record<string, PlaceholderDef>

function staff(roles: string[], scope: StaffRecipientRule['scope'] = 'ALL', extra: Partial<StaffRecipientRule> = {}): StaffRecipientRule {
  return { roles, scope, includeUserIds: [], excludeUserIds: [], notifyActor: false, excludeActor: true, ...extra }
}

const FINANCE_CONTROL = ['admin', 'bendahara', 'admin_koperasi']

export const NOTIF_EVENTS: NotifEventDefinition[] = [
  // ── Portal Ortu: tagihan & pembayaran ─────────────────────────────
  {
    code: 'PORTAL_TAGIHAN_TERBIT', module: 'keuangan', category: 'tagihan', audience: 'PARENT',
    label: 'Tagihan baru terbit', description: 'Ringkasan tagihan baru per santri setelah penerbitan otomatis.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Tagihan baru {periode}',
    inApp: 'Ada {jumlah} tagihan baru untuk {nama_santri} dengan total {total}.',
    push: 'Ada tagihan baru untuk {nama_santri}. Ketuk untuk melihat rincian.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.periode, P.jumlah, P.total],
  },
  {
    code: 'PORTAL_PEMBAYARAN_DITERIMA', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Pembayaran diterima', description: 'Pembayaran BRIVA atau tunai di loket sudah tercatat.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'success',
    title: 'Pembayaran Diterima',
    inApp: 'Pembayaran {nominal} untuk {nama_santri} melalui {metode} sudah diterima pada {waktu}.',
    push: 'Pembayaran untuk {nama_santri} sudah diterima. Ketuk untuk melihat rincian.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/riwayat',
    placeholders: [P.namaSantri, P.nominal, P.metode, P.waktu],
  },
  {
    code: 'PORTAL_TRANSFER_DITERIMA', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Transfer manual diterima', description: 'Petugas memverifikasi bukti transfer dengan nominal yang sesuai.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'success',
    title: 'Transfer Diterima',
    inApp: 'Transfer {nomor} sebesar {nominal} untuk {nama_santri} sudah diverifikasi dan diterima.',
    push: 'Transfer untuk {nama_santri} sudah diverifikasi. Ketuk untuk melihat rincian.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/riwayat',
    placeholders: [P.namaSantri, P.nomor, P.nominal],
  },
  {
    code: 'PORTAL_TRANSFER_BELUM_TERALOKASI', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Transfer diterima, menunggu penyesuaian', description: 'Nominal transfer berbeda; dana diterima tetapi belum dialokasikan.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Transfer Menunggu Penyesuaian',
    inApp: 'Transfer {nomor} sebesar {nominal} untuk {nama_santri} sudah diterima, tetapi nominalnya berbeda dari tagihan. Petugas akan menyesuaikan alokasinya.',
    push: 'Transfer untuk {nama_santri} diterima dan sedang disesuaikan petugas.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.nomor, P.nominal],
  },
  {
    code: 'PORTAL_TRANSFER_DITOLAK', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Transfer ditolak', description: 'Bukti transfer ditolak petugas verifikasi.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'danger',
    title: 'Transfer Ditolak',
    inApp: 'Bukti transfer {nomor} untuk {nama_santri} ditolak. Catatan petugas: {alasan}.',
    push: 'Bukti transfer untuk {nama_santri} ditolak. Ketuk untuk melihat catatan petugas.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.nomor, P.alasan],
  },
  {
    code: 'PORTAL_TRANSFER_PERLU_PERBAIKAN', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Bukti transfer perlu perbaikan', description: 'Petugas meminta wali mengunggah ulang bukti transfer.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Bukti Transfer Perlu Diperbaiki',
    inApp: 'Bukti transfer {nomor} untuk {nama_santri} perlu diperbaiki. Catatan petugas: {alasan}.',
    push: 'Bukti transfer untuk {nama_santri} perlu diperbaiki. Ketuk untuk mengunggah ulang.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.nomor, P.alasan],
  },
  {
    code: 'PORTAL_TRANSFER_AKAN_KEDALUWARSA', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Batas unggah bukti hampir habis', description: 'Pengingat sebelum order transfer kedaluwarsa (bukti belum diunggah).',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Segera Unggah Bukti Transfer',
    inApp: 'Order transfer {nomor} untuk {nama_santri} akan kedaluwarsa pada {batas_waktu}. Unggah bukti transfer sebelum batas waktu.',
    push: 'Order transfer untuk {nama_santri} akan kedaluwarsa pada {batas_waktu}.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.nomor, P.batasWaktu],
  },
  {
    code: 'PORTAL_TRANSFER_KEDALUWARSA', module: 'keuangan', category: 'pembayaran', audience: 'PARENT',
    label: 'Order transfer kedaluwarsa', description: 'Order transfer berakhir karena bukti tidak diunggah tepat waktu.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Order Transfer Kedaluwarsa',
    inApp: 'Order transfer {nomor} untuk {nama_santri} sudah kedaluwarsa. Silakan buat pembayaran baru bila masih diperlukan.',
    push: 'Order transfer untuk {nama_santri} sudah kedaluwarsa.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.nomor],
  },
  {
    code: 'PORTAL_PENGINGAT_TUNGGAKAN', module: 'keuangan', category: 'tagihan', audience: 'PARENT',
    label: 'Pengingat tunggakan', description: 'Pengingat berkala bila masih ada tagihan bulan lalu yang belum lunas.',
    wired: true, defaultEnabled: false, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Pengingat Tagihan',
    inApp: 'Masih ada {jumlah} tagihan {nama_santri} yang belum lunas dengan total {total}.',
    push: 'Masih ada tagihan {nama_santri} yang belum lunas. Ketuk untuk melihat rincian.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/tagihan',
    placeholders: [P.namaSantri, P.jumlah, P.total],
  },
  // ── Portal Ortu: uang jajan ───────────────────────────────────────
  {
    code: 'PORTAL_UANG_JAJAN_MASUK', module: 'keuangan', category: 'uang_jajan', audience: 'PARENT',
    label: 'Uang jajan masuk', description: 'Top up uang jajan (BRIVA, transfer, atau tunai) sudah masuk saldo.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'success',
    title: 'Uang Jajan Masuk',
    inApp: 'Uang jajan {nama_santri} bertambah {nominal}. Saldo sekarang {saldo}.',
    push: 'Uang jajan {nama_santri} sudah masuk. Ketuk untuk melihat saldo.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/beranda',
    placeholders: [P.namaSantri, P.nominal, P.saldo],
  },
  {
    code: 'PORTAL_PENCAIRAN_DIBAWA', module: 'koperasi', category: 'uang_jajan', audience: 'PARENT',
    label: 'Uang jajan dicairkan', description: 'Uang jajan dicairkan melalui perwakilan asrama (pencairan kolektif).',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Uang Jajan Dicairkan',
    inApp: 'Uang jajan {nama_santri} sebesar {nominal} dicairkan dan sedang dibawa oleh {perwakilan}.',
    push: 'Uang jajan {nama_santri} sedang dibawa perwakilan asrama.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/riwayat',
    placeholders: [P.namaSantri, P.nominal, P.perwakilan],
  },
  {
    code: 'PORTAL_PENCAIRAN_DITERIMA', module: 'koperasi', category: 'uang_jajan', audience: 'PARENT',
    label: 'Uang jajan diterima santri', description: 'Perwakilan menyerahkan uang jajan ke santri.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app'], level: 'success',
    title: 'Uang Jajan Diterima',
    inApp: 'Uang jajan {nama_santri} sebesar {nominal} sudah diterima santri.',
    push: 'Uang jajan {nama_santri} sudah diterima santri.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/riwayat',
    placeholders: [P.namaSantri, P.nominal],
  },
  {
    code: 'PORTAL_PENCAIRAN_DIBATALKAN', module: 'koperasi', category: 'uang_jajan', audience: 'PARENT',
    label: 'Pencairan uang jajan dibatalkan', description: 'Pencairan dibatalkan; uang kembali ke saldo santri.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Pencairan Dibatalkan',
    inApp: 'Pencairan uang jajan {nama_santri} sebesar {nominal} dibatalkan dan sudah kembali ke saldo. Catatan: {alasan}.',
    push: 'Pencairan uang jajan {nama_santri} dibatalkan; saldo sudah dikembalikan.',
    defaultPushPrivacy: 'MASKED', link: '/portal-ortu/riwayat',
    placeholders: [P.namaSantri, P.nominal, P.alasan],
  },
  // ── Pegawai: keuangan ─────────────────────────────────────────────
  {
    code: 'STAFF_TRANSFER_MENUNGGU_VERIFIKASI', module: 'keuangan', category: 'verifikasi_keuangan', audience: 'STAFF',
    label: 'Bukti transfer menunggu verifikasi', description: 'Wali mengunggah bukti transfer manual. Dikirim ke petugas sesuai cakupan asrama.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Bukti Transfer Menunggu Verifikasi',
    inApp: 'Bukti transfer {nomor} dari wali {nama_santri} ({asrama}) sebesar {nominal} menunggu verifikasi.',
    push: 'Bukti transfer dari wali {nama_santri} ({asrama}) menunggu verifikasi.',
    defaultPushPrivacy: 'MASKED', link: '/dashboard/keuangan/verifikasi-transfer',
    placeholders: [P.namaSantri, P.asrama, P.nomor, P.nominal],
    defaultRecipients: staff(['admin', 'bendahara', 'admin_koperasi', 'petugas_koperasi'], 'TRANSFER_VERIFIER'),
  },
  {
    code: 'STAFF_REKONSILIASI_BARU', module: 'keuangan', category: 'kontrol_keuangan', audience: 'STAFF',
    label: 'Item rekonsiliasi baru', description: 'Ada item rekonsiliasi baru yang perlu ditinjau.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Perlu Rekonsiliasi',
    inApp: 'Ada {jumlah} item rekonsiliasi baru: {jenis}.',
    push: 'Ada item rekonsiliasi baru yang perlu ditinjau.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/keuangan/rekonsiliasi',
    placeholders: [P.jumlah, P.jenis],
    defaultRecipients: staff(FINANCE_CONTROL),
  },
  {
    code: 'STAFF_BRIVA_ANOMALI', module: 'keuangan', category: 'kontrol_keuangan', audience: 'STAFF',
    label: 'Pembayaran BRIVA perlu ditinjau', description: 'Callback/recovery BRIVA tidak cocok dan masuk antrian peninjauan.',
    wired: true, defaultEnabled: true, defaultMandatory: true, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'danger',
    title: 'Pembayaran BRIVA Perlu Ditinjau',
    inApp: 'Ada {jumlah} pembayaran BRIVA yang perlu ditinjau: {jenis}.',
    push: 'Ada pembayaran BRIVA yang perlu ditinjau.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/keuangan/rekonsiliasi',
    placeholders: [P.jumlah, P.jenis],
    defaultRecipients: staff(['admin', 'bendahara']),
  },
  {
    code: 'STAFF_PENERBITAN_TAGIHAN_BERMASALAH', module: 'keuangan', category: 'kontrol_keuangan', audience: 'STAFF',
    label: 'Penerbitan tagihan bermasalah', description: 'Penerbitan otomatis menemukan tagihan yang perlu diperiksa.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app'], level: 'warning',
    title: 'Penerbitan Tagihan Perlu Diperiksa',
    inApp: 'Ada {jumlah} tagihan yang perlu diperiksa dari penerbitan otomatis periode {periode}.',
    push: 'Ada tagihan yang perlu diperiksa dari penerbitan otomatis.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/keuangan/status-pembayaran',
    placeholders: [P.jumlah, P.periode],
    defaultRecipients: staff(['admin', 'bendahara']),
  },
  {
    code: 'STAFF_SELISIH_KAS', module: 'koperasi', category: 'kontrol_keuangan', audience: 'STAFF',
    label: 'Selisih kas saat tutup sesi', description: 'Hitungan fisik berbeda dari saldo sistem saat sesi kas ditutup.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'warning',
    title: 'Selisih Kas',
    inApp: 'Sesi kas {petugas} ditutup dengan selisih {selisih}.',
    push: 'Ada sesi kas yang ditutup dengan selisih.',
    defaultPushPrivacy: 'MASKED', link: '/dashboard/koperasi/loket',
    placeholders: [P.petugas, P.selisih],
    defaultRecipients: staff(FINANCE_CONTROL),
  },
  {
    code: 'STAFF_SETORAN_SPP_MENUNGGU', module: 'asrama', category: 'setoran', audience: 'STAFF',
    label: 'Setoran SPP Juli menunggu Bendahara', description: 'Asrama menyetor SPP Juli santri baru ke Bendahara Pesantren.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Setoran SPP Menunggu Konfirmasi',
    inApp: 'Setoran SPP Juli santri baru dari {asrama} periode {periode} sebesar {nominal} menunggu konfirmasi Bendahara Pesantren.',
    push: 'Setoran SPP dari {asrama} menunggu konfirmasi.',
    defaultPushPrivacy: 'MASKED', link: '/dashboard/keuangan/setoran-spp-baru',
    placeholders: [P.asrama, P.periode, P.nominal],
    defaultRecipients: staff(['admin', 'bendahara']),
  },
  {
    code: 'STAFF_SETORAN_SPP_DIKONFIRMASI', module: 'asrama', category: 'setoran', audience: 'STAFF',
    label: 'Setoran SPP dikonfirmasi', description: 'Setoran diterima Bendahara Pesantren/Dewan Santri; dikirim ke pengurus asrama unit itu.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'success',
    title: 'Setoran SPP Dikonfirmasi',
    inApp: 'Setoran SPP {asrama} periode {periode} sebesar {nominal} sudah dikonfirmasi {pihak}.',
    push: 'Setoran SPP {asrama} sudah dikonfirmasi {pihak}.',
    defaultPushPrivacy: 'MASKED', link: '/dashboard/asrama/spp',
    placeholders: [P.asrama, P.periode, P.nominal, P.pihak],
    defaultRecipients: staff(['pengurus_asrama'], 'ASRAMA_BINAAN'),
  },
  {
    code: 'STAFF_SETORAN_DEWAN_MENUNGGU', module: 'asrama', category: 'setoran', audience: 'STAFF',
    label: 'Setoran SPP menunggu Dewan Santri', description: 'Asrama mengirim setoran SPP bulanan ke Dewan Santri.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Setoran SPP Menunggu Konfirmasi',
    inApp: 'Setoran SPP dari {asrama} periode {periode} sebesar {nominal} menunggu konfirmasi Dewan Santri.',
    push: 'Setoran SPP dari {asrama} menunggu konfirmasi.',
    defaultPushPrivacy: 'MASKED', link: '/dashboard/dewan-santri/setoran',
    placeholders: [P.asrama, P.periode, P.nominal],
    defaultRecipients: staff(['admin', 'dewan_santri']),
  },
  // ── Pegawai: approval non-keuangan ────────────────────────────────
  {
    code: 'STAFF_IZIN_DIAJUKAN', module: 'keamanan', category: 'perizinan', audience: 'STAFF',
    label: 'Pengajuan izin baru', description: 'Asrama mengajukan izin santri yang perlu diputuskan.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Pengajuan Izin Baru',
    inApp: 'Pengajuan izin {nama_santri} ({asrama}) untuk {keperluan} menunggu keputusan.',
    push: 'Pengajuan izin {nama_santri} ({asrama}) menunggu keputusan.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/keamanan/perizinan',
    placeholders: [P.namaSantri, P.asrama, P.keperluan],
    defaultRecipients: staff(['admin', 'dewan_santri']),
  },
  {
    code: 'STAFF_IZIN_DIPUTUSKAN', module: 'keamanan', category: 'perizinan', audience: 'STAFF',
    label: 'Pengajuan izin diputuskan', description: 'Hasil persetujuan izin dikirim ke pengaju (pengurus asrama).',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Pengajuan Izin {keputusan}',
    inApp: 'Pengajuan {keperluan} untuk {nama_santri} {keputusan}.',
    push: 'Pengajuan izin {nama_santri} {keputusan}.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/keamanan/perizinan',
    placeholders: [P.namaSantri, P.keperluan, P.keputusan],
    defaultRecipients: staff([], 'ALL', { notifyActor: true, excludeActor: false }),
  },
  {
    code: 'STAFF_SANTRI_KELUAR_DIAJUKAN', module: 'santri', category: 'kesantrian', audience: 'STAFF',
    label: 'Pengajuan santri keluar', description: 'Asrama menandai santri keluar dan menunggu persetujuan.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Pengajuan Santri Keluar',
    inApp: 'Pengajuan keluar {nama_santri} ({asrama}) menunggu persetujuan.',
    push: 'Pengajuan keluar {nama_santri} ({asrama}) menunggu persetujuan.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/santri/keluar',
    placeholders: [P.namaSantri, P.asrama],
    defaultRecipients: staff(['admin', 'sekpen', 'dewan_santri']),
  },
  {
    code: 'STAFF_SANTRI_KELUAR_DIPUTUSKAN', module: 'santri', category: 'kesantrian', audience: 'STAFF',
    label: 'Pengajuan santri keluar diputuskan', description: 'Hasil persetujuan santri keluar dikirim ke pengaju.',
    wired: true, defaultEnabled: true, defaultMandatory: false, defaultChannels: ['in_app', 'webpush', 'fcm'], level: 'info',
    title: 'Pengajuan Santri Keluar {keputusan}',
    inApp: 'Pengajuan keluar {nama_santri} {keputusan}. Catatan: {catatan}.',
    push: 'Pengajuan keluar {nama_santri} {keputusan}.',
    defaultPushPrivacy: 'FULL', link: '/dashboard/asrama/kamar',
    placeholders: [P.namaSantri, P.keputusan, P.catatan],
    defaultRecipients: staff([], 'ALL', { notifyActor: true, excludeActor: false }),
  },
]

const BY_CODE = new Map(NOTIF_EVENTS.map(e => [e.code, e]))

export function getEventDefinition(code: string): NotifEventDefinition | null {
  return BY_CODE.get(code) ?? null
}

export function requireEventDefinition(code: string): NotifEventDefinition {
  const def = BY_CODE.get(code)
  if (!def) throw new Error(`Jenis notifikasi tidak dikenal: ${code}`)
  return def
}

/** Payload contoh untuk preview & kirim uji. */
export function samplePayload(def: NotifEventDefinition): Record<string, string | number> {
  return Object.fromEntries(def.placeholders.map(p => [p.key, p.sample]))
}
