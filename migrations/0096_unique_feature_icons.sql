-- Migration 0096: Memperbarui ikon fitur agar unik dan relevan
-- Menghilangkan duplikasi ikon antar fitur pada halaman utama dan sidebar

-- 1. Duplikasi UserCheck
UPDATE fitur_akses SET icon = 'ChalkboardTeacher' WHERE href = '/dashboard/akademik/absensi-guru/rekap';
UPDATE fitur_akses SET icon = 'SignIn' WHERE href = '/dashboard/asrama/santri-kembali';
UPDATE fitur_akses SET icon = 'Eye' WHERE href = '/dashboard/ehb/pengawas';
UPDATE fitur_akses SET icon = 'ListChecks' WHERE href = '/dashboard/ehb/absensi';
UPDATE fitur_akses SET icon = 'Chalkboard' WHERE href = '/dashboard/master/wali-kelas';

-- 2. Duplikasi Printer
UPDATE fitur_akses SET icon = 'ChartPie' WHERE href = '/dashboard/dewan-santri/sensus/laporan';
UPDATE fitur_akses SET icon = 'IdentificationBadge' WHERE href = '/dashboard/ehb/cetak';

-- 3. Duplikasi FileText
UPDATE fitur_akses SET icon = 'Notebook' WHERE href = '/dashboard/akademik/absensi/cetak-blanko';
UPDATE fitur_akses SET icon = 'ChartLine' WHERE href = '/dashboard/keuangan/laporan';

-- 4. Duplikasi ClipboardCheck
UPDATE fitur_akses SET icon = 'ShieldCheck' WHERE href = '/dashboard/ehb/absensi-pengawas';

-- 5. Duplikasi UserPlus
UPDATE fitur_akses SET icon = 'UserCirclePlus' WHERE href = '/dashboard/santri/atur-kelas';

-- 6. Duplikasi BarChart3
UPDATE fitur_akses SET icon = 'PresentationChart' WHERE href = '/dashboard/akademik/grading';

-- 7. Duplikasi Moon
UPDATE fitur_akses SET icon = 'Table' WHERE href = '/dashboard/keamanan/rekap-absen-malam';

-- 8. Duplikasi Flame
UPDATE fitur_akses SET icon = 'Sun' WHERE href = '/dashboard/keamanan/rekap-absen-berjamaah';

-- 9. Duplikasi DoorOpen
UPDATE fitur_akses SET icon = 'Bed' WHERE href = '/dashboard/asrama/plotting-kamar-manual';

-- 10. Duplikasi UserCog
UPDATE fitur_akses SET icon = 'UsersThree' WHERE href = '/dashboard/asrama/kepengurusan';
UPDATE fitur_akses SET icon = 'IdentificationCard' WHERE href = '/dashboard/ehb/kepanitiaan';

-- 11. Duplikasi LayoutList
UPDATE fitur_akses SET icon = 'Columns' WHERE href = '/dashboard/ehb/ruangan';
UPDATE fitur_akses SET icon = 'HandCoins' WHERE href = '/dashboard/asrama/status-setoran';
UPDATE fitur_akses SET icon = 'Cardholder' WHERE href = '/dashboard/dewan-santri/setoran';

-- 12. Duplikasi Users
UPDATE fitur_akses SET icon = 'Wrench' WHERE href = '/dashboard/master/santri-tools';

-- 13. Duplikasi CalendarDays
UPDATE fitur_akses SET icon = 'CalendarBlank' WHERE href = '/dashboard/ehb/jadwal';
UPDATE fitur_akses SET icon = 'Calendar' WHERE href = '/dashboard/pengaturan/tahun-ajaran';

-- 14. Duplikasi ClipboardList
UPDATE fitur_akses SET icon = 'ListDashes' WHERE href = '/dashboard/pengaturan/log-aktivitas';

-- 15. Duplikasi Wallet
UPDATE fitur_akses SET icon = 'Bank' WHERE href = '/dashboard/ehb/keuangan';
UPDATE fitur_akses SET icon = 'PiggyBank' WHERE href = '/dashboard/asrama/uang-jajan';
UPDATE fitur_akses SET icon = 'HandCoins' WHERE href = '/dashboard/dewan-santri/uang-jajan';
UPDATE fitur_akses SET icon = 'PlusCircle' WHERE href = '/dashboard/akademik/upk/pemasukan';

-- 16. Duplikasi CreditCard
UPDATE fitur_akses SET icon = 'MinusCircle' WHERE href = '/dashboard/akademik/upk/pengeluaran';

-- 17. Duplikasi Book
UPDATE fitur_akses SET icon = 'Bookmark' WHERE href = '/dashboard/keamanan/denda-buku-pribadi';

-- 18. Duplikasi BookOpen
UPDATE fitur_akses SET icon = 'Books' WHERE href = '/dashboard/akademik/upk/katalog';

-- 19. Perbaikan Ikon Error/Tidak Terdaftar
UPDATE fitur_akses SET icon = 'Cardholder' WHERE href = '/dashboard/operasional';
