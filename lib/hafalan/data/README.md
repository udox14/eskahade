# Data teks hafalan

Teks ayat/hadits/matan disimpan sebagai JSON statis di sini. Tiap `hafalan_blok`
menyimpan kolom `ref` yang menunjuk ke salah satu entri. Resolver:
[`lib/hafalan/text.ts`](../text.ts) → `resolveHafalanText(ref)`.

File seed di repo ini **contoh kecil** — ganti dengan data lengkap.

## Format ref

| Jenis     | ref                          | resolusi                                  |
|-----------|------------------------------|-------------------------------------------|
| quran     | `quran:{surah}:{ayah}`       | `quran.json[surah].ayat[ayah]`            |
| hadits    | `hadits:{kitab}:{slug}:{n}`  | `hadits/{kitab}.json` → bab[slug].segmen[n] |
| jurumiyah | `jurumiyah:{slug}:{n}`       | `jurumiyah.json` → bab[slug].segmen[n]    |
| amtsilah  | `amtsilah:{slug}`            | `amtsilah.json` → wazan[slug]             |

## Bentuk file

```jsonc
// quran.json — key = nomor surat (string)
{ "1": { "nama": "الفاتحة", "latin": "Al-Fatihah",
  "ayat": { "1": "بِسْمِ...", "2": "..." } } }

// hadits/<kitab>.json — bersegmen per bab (daftar di HADITS_KITAB pada text.ts)
{ "kitab": "akhlaq-ibtidaiyah-1", "judul": "Hadits Akhlaq Ibtidaiyah 1",
  "bab": { "tema-1": { "nama": "1. العبادة لله", "urutan": 1,
                       "segmen": { "1": { "arab": "...", "terjemah": "..." } } } } }

// jurumiyah.json — per bab dipecah jadi segmen (guru bisa blok/swipe sebagian)
{ "judul": "Matan Al-Ajurrumiyyah",
  "bab": { "bab-1": { "nama": "باب الكلام", "urutan": 1,
                      "segmen": { "1": "...", "2": "..." } } } }

// amtsilah.json — key = slug (lihat hafalanSlug())
{ "judul": "...", "wazan": { "fa-ala-yaf-ulu": { "arab": "...", "terjemah": "..." } } }
```

## Matan bawaan (seed 1-klik)

`getMatanBab(jenis)` di [text.ts](../text.ts) mengubah JSON → daftar bab+segmen.
Master Hafalan punya tombol **"Isi dari Matan"** yang membuat bab + blok ber-`ref`
otomatis. Tambah jenis bermatan → daftarkan di `getMatanBab` + sediakan JSON-nya.

Converter docx→json (jurumiyah dibuat begini): parse paragraf, judul bold = bab,
body dipecah per titik jadi segmen.

## Menambah kitab hadits baru

1. Buat `hadits/<kitab>.json`.
2. Daftarkan di `HADITS_KITAB` dalam `lib/hafalan/text.ts`.
