# Arah Desain Keuangan Terpusat

Design Read:

> Dashboard operasional keuangan untuk petugas pesantren, dengan bahasa visual control-panel yang padat dan tenang. ENERGY 1 / RHYTHM 2 / MOTION 1.

## Tujuan dan pengguna

- Pengguna utama: petugas loket, operator keuangan, bendahara, dan admin.
- Tujuan utama: mengenali kondisi, menemukan transaksi, lalu menyelesaikan tindakan finansial dengan cepat dan aman.
- Antarmuka mendahulukan keterbacaan nominal, status, dampak tindakan, dan jejak pekerjaan. Dekorasi tidak boleh bersaing dengan data.

## Bahasa visual

- Emerald adalah aksen identitas dan aksi utama. Slate menjadi warna struktur dan data.
- Amber hanya untuk tindakan yang perlu perhatian atau rekonsiliasi. Red hanya untuk kegagalan dan tindakan yang membatalkan, mencabut, atau membuat objek tidak dapat digunakan.
- Tipografi mengikuti sistem dashboard. Nominal memakai angka tabular; label pendukung ringkas dan tidak dibuat seperti slogan.
- Density rapat tetapi tidak sesak: kontrol minimal 44 px, baris data mudah dipindai, dan ruang lebih besar hanya memisahkan kelompok pekerjaan.

## Hierarki komponen

- Radius kontrol: `rounded-md`.
- Radius surface dan panel data: `rounded-lg`.
- Radius modal: `rounded-xl`.
- Badge status: `rounded-full`.
- Shadow hanya untuk overlay, sticky action bar, atau layer yang benar-benar berada di atas konten. Surface biasa cukup memakai border.
- Gradient hanya dipakai pada preview kartu fisik untuk membedakan sisi depan dan belakang artefak; bukan sebagai treatment panel dashboard.
- Ikon Phosphor dipakai ketika mempercepat pengenalan objek atau aksi, misalnya cetak, pindai, peringatan, urutkan, dan tutup. Navigasi dan label yang sudah jelas tetap berbasis teks.

## Perilaku

- Satu aksi utama per kelompok pekerjaan; aksi pendukung memakai outline netral.
- Tindakan rekonsiliasi memakai amber. Tindakan pembatalan, refund, kehilangan, atau pencabutan memakai red serta menampilkan dampak sebelum eksekusi.
- Motion terbatas pada hover, focus, pembukaan dialog, dan progres yang menjelaskan perubahan status.
- Di mobile, ringkasan kartu harus menampilkan informasi yang dipakai untuk mengambil keputusan, bukan sekadar kolom pertama tabel.
