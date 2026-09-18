import type { PaymentModuleCode } from "./modules";

export type ModuleGuide = {
  purpose: string;
  prerequisites: string[];
  workflow: string[];
  attention: string[];
  checklist: Record<"tarif" | "periode" | "peserta" | "generate" | "hasil", string>;
};

export const MODULE_GUIDES: Record<PaymentModuleCode, ModuleGuide> = {
  UANG_JAJAN: {
    purpose: "Mencatat uang titipan dari wali, melihat saldo setiap santri, dan menelusuri uang yang dicairkan atau dipakai. Modul ini tidak membuat tagihan wajib.",
    prerequisites: [
      "Pastikan santri masih aktif dan identitasnya sesuai.",
      "Cocokkan nominal serta kanal penerimaan dengan uang atau bukti transfer.",
      "Sebelum pencairan, periksa saldo tersedia dan identitas santri.",
    ],
    workflow: [
      "Terima setoran melalui Loket Pembayaran atau Pembayaran Gabungan, lalu pilih item Uang Jajan.",
      "Periksa halaman Pembayaran untuk memastikan setoran masuk ke santri yang benar.",
      "Layani pengambilan melalui Loket & Uang Jajan setelah memeriksa identitas dan saldo.",
      "Cocokkan setoran, pencairan, dan saldo melalui Dashboard serta Laporan.",
    ],
    attention: [
      "Generate Tagihan tidak dipakai karena saldo berasal dari setoran sukarela.",
      "Koreksi kesalahan dengan pembatalan atau refund; jangan menghapus riwayat.",
    ],
    checklist: {
      tarif: "Aturan atau batas uang jajan sudah dipahami",
      periode: "Periode pemantauan saldo sudah benar",
      peserta: "Identitas santri dan status aktif sudah diperiksa",
      generate: "Alur setoran dan pencairan di loket sudah dicoba",
      hasil: "Saldo, setoran, dan pencairan sudah dicocokkan",
    },
  },
  MAKAN: {
    purpose: "Mengelola tagihan makan bulanan, penerimaan pembayaran, dan hak dana yang akan disalurkan kepada pengelola makan.",
    prerequisites: [
      "Pastikan tarif makan untuk bulan yang diproses sudah aktif.",
      "Periksa tempat makan setiap santri dan pembebasan biaya yang berlaku.",
      "Periksa periode serta tanggal jatuh tempo sebelum membuat tagihan.",
    ],
    workflow: [
      "Atur periode, jatuh tempo, tarif, peserta, dan pembebasan biaya.",
      "Buka Generate Tagihan, pilih bulan, lalu posting tagihan makan.",
      "Pantau pembayaran dan tagihan yang masih terbuka atau jatuh tempo.",
      "Buat draft penyaluran sesuai hak bersih, lalu konfirmasi setelah dana diterima pengelola.",
      "Cocokkan tagihan, penerimaan, dan penyaluran pada Laporan.",
    ],
    attention: [
      "Santri tanpa tempat makan atau yang dibebaskan tidak seharusnya menerima tagihan.",
      "Biaya transfer mengurangi nilai bersih; masukkan sesuai bukti.",
    ],
    checklist: {
      tarif: "Tarif makan bulan berjalan sudah diperiksa",
      periode: "Periode dan jatuh tempo tagihan makan sudah benar",
      peserta: "Tempat makan serta pembebasan santri sudah diperiksa",
      generate: "Tagihan makan sudah dibuat dan data yang dilewati sudah ditinjau",
      hasil: "Penerimaan, hak pengelola, dan penyaluran sudah dicocokkan",
    },
  },
  LAUNDRY: {
    purpose: "Mengelola tagihan laundry bulanan, pembayaran santri, dan dana yang menjadi hak pengelola laundry.",
    prerequisites: [
      "Pastikan tarif laundry untuk bulan yang diproses sudah aktif.",
      "Periksa tempat laundry setiap santri dan pembebasan biaya yang berlaku.",
      "Periksa periode serta tanggal jatuh tempo sebelum membuat tagihan.",
    ],
    workflow: [
      "Atur periode, jatuh tempo, tarif, peserta, dan pembebasan biaya.",
      "Buka Generate Tagihan, pilih bulan, lalu posting tagihan laundry.",
      "Pantau pembayaran dan tagihan yang masih terbuka atau jatuh tempo.",
      "Buat draft penyaluran sesuai hak bersih, lalu konfirmasi setelah dana diterima pengelola.",
      "Cocokkan tagihan, penerimaan, dan penyaluran pada Laporan.",
    ],
    attention: [
      "Santri tanpa tempat laundry atau yang dibebaskan tidak seharusnya menerima tagihan.",
      "Jangan konfirmasi penyaluran sebelum penerima dan referensi bukti sudah benar.",
    ],
    checklist: {
      tarif: "Tarif laundry bulan berjalan sudah diperiksa",
      periode: "Periode dan jatuh tempo tagihan laundry sudah benar",
      peserta: "Tempat laundry serta pembebasan santri sudah diperiksa",
      generate: "Tagihan laundry sudah dibuat dan data yang dilewati sudah ditinjau",
      hasil: "Penerimaan, hak pengelola, dan penyaluran sudah dicocokkan",
    },
  },
  SPP: {
    purpose: "Membuat tagihan SPP bulanan, memantau pembayaran, dan mengetahui tunggakan santri per periode.",
    prerequisites: [
      "Pastikan tarif SPP sesuai angkatan atau ketentuan yang berlaku.",
      "Periksa santri aktif, status bebas SPP, periode, dan jatuh tempo.",
      "Selesaikan perubahan tarif atau pembebasan sebelum generate.",
    ],
    workflow: [
      "Pilih bulan kerja dan periksa estimasi target pada Dashboard.",
      "Generate tagihan SPP lalu tinjau data yang berhasil atau dilewati.",
      "Pantau pembayaran, sisa tagihan, dan daftar yang melewati jatuh tempo.",
      "Gunakan Laporan untuk rekonsiliasi dan penelusuran perubahan.",
    ],
    attention: [
      "Generate ulang aman karena tagihan lama dilewati, tetapi hasil tetap harus ditinjau.",
      "Pembayaran parsial tetap menyisakan tagihan terbuka.",
    ],
    checklist: {
      tarif: "Tarif SPP dan ketentuan angkatan sudah diperiksa",
      periode: "Bulan tagihan dan jatuh tempo SPP sudah benar",
      peserta: "Santri aktif dan status bebas SPP sudah diperiksa",
      generate: "Tagihan SPP sudah dibuat dan data yang dilewati sudah ditinjau",
      hasil: "Pembayaran, sisa tagihan, dan tunggakan sudah dicocokkan",
    },
  },
  BANGUNAN: {
    purpose: "Mengelola tagihan biaya bangunan jangka panjang, termasuk pembayaran bertahap atau cicilan setiap santri.",
    prerequisites: [
      "Pastikan nominal biaya bangunan per angkatan sudah benar.",
      "Periksa tahun masuk santri dan pembebasan biaya.",
      "Pahami bahwa tagihan bangunan dapat dibayar bertahap dan tidak dibatasi satu bulan.",
    ],
    workflow: [
      "Periksa estimasi target berdasarkan angkatan dan tarif.",
      "Generate tagihan Bangunan; tagihan yang sudah ada akan dilewati.",
      "Pantau cicilan pada Pembayaran dan sisa kewajiban pada Daftar Tagihan.",
      "Rekonsiliasi perubahan serta penerimaan melalui Laporan.",
    ],
    attention: [
      "Jangan membuat tagihan baru hanya karena pembayaran lama masih parsial.",
      "Jika angkatan santri salah, benahi data sumber sebelum generate.",
    ],
    checklist: {
      tarif: "Tarif bangunan per angkatan sudah diperiksa",
      periode: "Konteks tahun ajaran dan jatuh tempo sudah dipahami",
      peserta: "Angkatan serta pembebasan santri sudah diperiksa",
      generate: "Tagihan dibuat tanpa menduplikasi tagihan lama",
      hasil: "Cicilan, sisa kewajiban, dan penerimaan sudah dicocokkan",
    },
  },
  BIAYA_TAHUNAN: {
    purpose: "Mengelola biaya EHB, Ekstra/Ekskul, dan Kesehatan untuk satu tahun ajaran, bersama-sama atau per jenis.",
    prerequisites: [
      "Pastikan tahun ajaran aktif dan tarif tiap jenis biaya per angkatan sudah benar.",
      "Periksa jenis biaya yang akan diproses agar tidak keliru memilih Semua Jenis.",
      "Periksa angkatan dan pembebasan EHB, Ekstra/Ekskul, atau Kesehatan secara terpisah.",
    ],
    workflow: [
      "Pilih tahun ajaran dan, bila perlu, saring satu jenis biaya.",
      "Bandingkan estimasi target dengan peserta dan tarif aktif.",
      "Generate semua jenis atau satu jenis pilihan, lalu tinjau hasilnya.",
      "Pantau pembayaran dan sisa tagihan per jenis biaya.",
      "Gunakan Laporan untuk rekonsiliasi akhir tahun ajaran.",
    ],
    attention: [
      "Pembebasan satu jenis tidak otomatis membebaskan jenis biaya lainnya.",
      "Periksa filter jenis biaya sebelum mengekspor.",
    ],
    checklist: {
      tarif: "Tarif EHB, Ekstra/Ekskul, dan Kesehatan sudah diperiksa",
      periode: "Tahun ajaran aktif sudah benar",
      peserta: "Angkatan dan pembebasan per jenis sudah diperiksa",
      generate: "Jenis tagihan pilihan sudah dibuat dan hasilnya ditinjau",
      hasil: "Pembayaran dan sisa tagihan per jenis sudah dicocokkan",
    },
  },
};

type ModuleSection = "dashboard" | "tagihan" | "generate" | "pembayaran" | "penyaluran" | "laporan" | "pengaturan" | "petunjuk";

export function moduleSectionSteps(moduleCode: PaymentModuleCode, section: ModuleSection, label: string) {
  const wallet = moduleCode === "UANG_JAJAN";
  const steps: Record<ModuleSection, string[]> = {
    dashboard: [
      "Pilih periode, lalu tekan Tampilkan periode.",
      "Baca kartu ringkasan dari target, penerimaan, sisa, sampai saldo tersedia.",
      "Tekan Lihat data pembentuk pada angka yang perlu diperiksa.",
    ],
    tagihan: wallet
      ? ["Uang Jajan tidak membuat kewajiban atau tagihan.", "Telusuri setoran di Pembayaran dan pencairan di Loket & Uang Jajan."]
      : ["Pastikan periode atau tahun ajaran sudah benar.", "Periksa nominal, pembayaran, sisa, status, dan jatuh tempo.", "Gunakan filter OPEN atau OVERDUE dari Dashboard untuk memusatkan pemeriksaan."],
    generate: wallet
      ? ["Jangan membuat tagihan Uang Jajan.", "Catat uang masuk sebagai setoran melalui alur pembayaran.", "Cocokkan hasilnya pada halaman Pembayaran."]
      : ["Periksa tarif, peserta, pembebasan, periode, dan jatuh tempo.", "Pilih periode atau jenis biaya " + label + ".", "Tekan Generate dan posting tagihan satu kali, lalu tinjau hasil.", "Jika dijalankan ulang, tagihan yang sudah ada akan dilewati."],
    pembayaran: [
      "Halaman ini menampilkan pembayaran yang sudah dicatat.",
      "Cocokkan waktu, santri, item, nominal, kanal, dan status.",
      "Jika salah, catat referensinya lalu gunakan pembatalan atau refund.",
    ],
    penyaluran: wallet
      ? ["Layani pencairan melalui Loket & Uang Jajan.", "Periksa saldo dan identitas santri sebelum menyerahkan uang.", "Gunakan daftar ini untuk menelusuri riwayat pencairan."]
      : ["Pastikan Saldo Tersedia mencukupi dan penerima sudah benar.", "Isi nominal bruto, biaya transfer, dan metode untuk membuat draft.", "Serahkan atau transfer dana sesuai draft.", "Setelah diterima, isi nomor pencairan, referensi, penerima, dan bukti sebelum konfirmasi."],
    laporan: [
      "Tentukan periode yang sedang direkonsiliasi.",
      "Cocokkan tagihan, pembayaran, pembatalan, dan penyaluran dengan bukti.",
      "Gunakan waktu, tindakan, objek, referensi, dan petugas untuk menelusuri perubahan.",
      "Ekspor data bila perlu diperiksa atau diarsipkan.",
    ],
    pengaturan: [
      "Isi periode aktif dan tanggal jatuh tempo.",
      "Simpan sebelum petugas melakukan generate tagihan.",
      "Admin dapat memberi izin seperlunya; VIEW adalah akses dasar.",
      "Periksa daftar petugas setelah menyimpan.",
    ],
    petunjuk: [
      "Baca fungsi, syarat awal, dan urutan kerja lengkap.",
      "Centang checklist setelah langkah benar-benar diperiksa atau dicoba.",
      "Simpan progres; checklist tidak mengubah transaksi.",
    ],
  };
  return steps[section];
}
