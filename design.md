# ESKAHADE Public Experience Design System

## 1. Arah dan prinsip

Tampilan publik ESKAHADE memakai pendekatan **editorial pesantren**: hangat, berwibawa, tenang, dan tetap terasa modern. Identitas tidak bergantung pada foto stok; logo resmi, tipografi, bidang warna, garis, dan pola geometris menjadi elemen utama.

Prinsip utama:

1. **Jelas sebelum dekoratif** — jalur Pengurus dan Orang Tua selalu mudah ditemukan.
2. **Hangat dan terpercaya** — krem sebagai kanvas, hijau sebagai fondasi, emas hanya sebagai aksen.
3. **Berkarakter namun efisien** — serif dipakai untuk judul; sans-serif untuk navigasi, formulir, dan informasi.
4. **Responsif sejak awal** — konten tetap utuh dari layar 360px hingga desktop lebar.
5. **Gerak yang bermakna** — animasi lembut untuk orientasi, bukan gangguan.

## 2. Token visual

Token publik memakai awalan `--public-*` dan hanya aktif di dalam `.public-theme` agar dashboard tidak terdampak.

### Warna

| Token | Nilai | Fungsi |
| --- | --- | --- |
| `--public-forest` | `#12372a` | Latar utama, teks kuat |
| `--public-forest-deep` | `#09251c` | Bidang gelap dan footer |
| `--public-leaf` | `#247451` | Tombol utama, focus, ikon |
| `--public-leaf-light` | `#dcecdf` | Bidang hijau lembut |
| `--public-cream` | `#f7f1e5` | Kanvas utama |
| `--public-paper` | `#fffdf8` | Card dan form |
| `--public-gold` | `#c9952e` | Aksen premium |
| `--public-gold-light` | `#f1e2b8` | Aksen lembut |
| `--public-ink` | `#1c2923` | Teks utama |
| `--public-muted` | `#66736c` | Teks sekunder |
| `--public-line` | `#ddd4c3` | Border |
| `--public-danger` | `#b4233d` | Error |

Kontras minimum teks mengikuti WCAG AA. Emas tidak digunakan sebagai warna teks kecil di atas krem.

### Tipografi

- Display: `Fraunces`, serif; bobot 600–700 untuk judul dan angka editorial.
- Interface: `Plus Jakarta Sans`, sans-serif; bobot 400–800 untuk seluruh kontrol dan informasi.
- Skala judul memakai `clamp()` agar tumbuh halus antarlebar layar.
- Isi paragraf maksimal 65–70 karakter per baris.

### Spacing, radius, dan shadow

- Spacing dasar: 4px; urutan utama 8, 12, 16, 24, 32, 48, 64, 96px.
- Radius: 12px untuk kontrol, 20px untuk card, 28–36px untuk panel utama.
- Shadow card: `0 24px 70px rgba(18, 55, 42, .12)`.
- Shadow tombol: `0 12px 30px rgba(18, 55, 42, .18)`.

## 3. Komponen

### Tombol

- Primer: hijau solid, teks putih, ikon opsional di kanan.
- Sekunder: paper/krem, border hijau transparan, teks hijau tua.
- Tinggi minimum 48px; area sentuh tidak kurang dari 44px.
- State wajib: hover, `focus-visible`, active, disabled, dan loading.

### Form

- Label selalu terlihat dan tidak digantikan placeholder.
- Input setinggi minimum 52px, latar paper, border lembut.
- Focus memakai ring hijau 3px dengan offset.
- Pesan error berada dekat form dan diumumkan dengan `role="alert"`.

### Card dan badge

- Card memakai paper, border tipis, dan shadow lembut.
- Badge hanya untuk konteks singkat; uppercase dengan tracking lebar.
- Ikon ditempatkan dalam bidang sederhana dan tidak menjadi satu-satunya pembeda informasi.

## 4. Layout responsif

- Mobile: `360–767px`, satu kolom, padding horizontal 20–24px.
- Tablet: `768–1023px`, grid dua kolom jika ruang cukup.
- Desktop: `1024px+`, container maksimum 1200px.
- Auth desktop memakai panel narasi + panel form; di mobile narasi dipadatkan menjadi header.
- Navigasi mobile selalu menampilkan dua akses login tanpa menu tersembunyi.

## 5. Gerak dan aksesibilitas

- Durasi transisi 160–240ms; entrance maksimal 600ms.
- Semua elemen interaktif dapat dicapai dengan keyboard dan memiliki focus yang jelas.
- Ikon dekoratif diberi `aria-hidden`; tombol ikon memiliki `aria-label`.
- `prefers-reduced-motion: reduce` menonaktifkan animasi, transform, dan smooth scrolling.
- Logo memiliki teks alternatif yang menjelaskan institusi.

## 6. Contoh penggunaan

```tsx
<Link className="public-button public-button-primary" href="/login">
  Login Pengurus Pesantren
</Link>

<label className="public-field">
  <span>Email</span>
  <input type="email" autoComplete="username" />
</label>
```

Aturan ini berlaku untuk `/`, `/login`, dan `/portal-ortu/login`. Halaman dashboard dan isi portal mempertahankan sistem visualnya masing-masing.

## 7. Beranda internal /dashboard

Aturan ini khusus beranda internal. Sidebar desktop tetap digunakan, sedangkan header putih dan padding shell dihilangkan hanya pada /dashboard. Halaman lain mempertahankan shell existing.

- Hero menggunakan gambar penuh dari tepi atas area konten dengan tinggi yang lebih ringkas. Tampilkan logo resmi public/logo.png, nama ESKAHADE, sapaan kecil, nama lengkap satu baris yang mengecil sesuai lebar, dan label role utama. Jangan memotong nama dengan ellipsis. Kontrol profil, menu mobile, dan tombol Segarkan memakai area sentuh yang jelas. Admin mengubah gambar, crop, dan warna teks melalui pengaturan dashboard.
- Running text berada tepat di bawah hero. Tampilkan ikon dan isi saja, tanpa label �Pengumuman�. Gunakan warna pilihan admin dan hentikan gerak ketika prefers-reduced-motion: reduce; isi tetap terbaca.
- Gunakan latar #f7f1e5, permukaan #fffdf8, tinta #1c2923, hijau #12372a, hijau aksi #247451, dan aksen emas #c9952e. Jaga tinggi hero, pintasan, padding, dan jarak antarseksi tetap ringkas. Hindari bayangan berat dan kartu berlapis.
- Pintasan maksimal delapan, tersusun empat kolom di mobile dan desktop. Urutan berasal dari pilihan pengguna; menu yang izinnya dicabut harus hilang. Modal pengaturan pintasan tetap tersedia.
- Widget beranda sedang ditunda. Sembunyikan bagian kartu dan jangan memanggil loader widget dari halaman dashboard. Pertahankan katalog serta pilihan widget per role; beri keterangan di pengaturan admin bahwa widget belum tampil. Saat widget diaktifkan lagi, judul bagiannya hanya �Ringkasan�.
- Tombol Menu pada navbar bawah dan tombol menu di header/hero membuka panel dari bawah setinggi sekitar 68dvh. Panel menampilkan akses Dashboard, pencarian, dan seluruh menu aktif yang diizinkan, dikelompokkan mengikuti label serta urutan grup existing. Panel dapat ditutup dengan tombol, klik latar, atau Escape.
- Navbar bawah mobile memakai warna krem dan hijau yang sama, indikator aktif yang terlihat, label �Menu�, dan ruang aman perangkat. Sidebar desktop tidak berubah. Saat navbar bawah dinonaktifkan, tombol menu pada hero dan header tetap tersedia.
- Kontrol memiliki label aksesibilitas dan fokus keyboard yang jelas. Transisi non-esensial dihentikan saat pengguna meminta gerakan berkurang.
