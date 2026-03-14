"""
generate-icons.py — PWA Icon Generator untuk ESKAHADE
======================================================
Cara pakai:
1. Taruh file ini di ROOT folder proyek (sejajar dengan folder 'public/')
2. Pastikan logo baru sudah ada di public/logo.png
3. Jalankan: python generate-icons.py

Syarat logo.png:
- Format PNG dengan background transparan (RGBA)
- Ukuran minimal 512x512 px
- Makin besar makin bagus (1024x1024 ideal)
- Boleh tidak square, script ini akan handle otomatis

Install dependency dulu kalau belum ada:
  pip install Pillow
"""

from PIL import Image
import os
import sys

# ── Cek file logo ada ──────────────────────────────────────────────────────
LOGO_PATH = os.path.join("public", "logo.png")
if not os.path.exists(LOGO_PATH):
    print(f"ERROR: File '{LOGO_PATH}' tidak ditemukan!")
    print("Pastikan script ini dijalankan dari ROOT folder proyek.")
    sys.exit(1)

print(f"Membaca logo dari: {LOGO_PATH}")
img = Image.open(LOGO_PATH).convert("RGBA")
w, h = img.size
print(f"Ukuran asli: {w}x{h}")

# ── Buat canvas square dengan padding 10% ────────────────────────────────
max_dim = max(w, h)
padding = int(max_dim * 0.10)
canvas_size = max_dim + (padding * 2)

canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
offset_x = (canvas_size - w) // 2
offset_y = (canvas_size - h) // 2
canvas.paste(img, (offset_x, offset_y), img)
print(f"Canvas square: {canvas_size}x{canvas_size} (dengan padding {padding}px)\n")

# ── Generate semua ukuran ─────────────────────────────────────────────────
SIZES = [
    (16,  "favicon-16x16.png"),
    (32,  "favicon-32x32.png"),
    (72,  "icon-72x72.png"),
    (96,  "icon-96x96.png"),
    (128, "icon-128x128.png"),
    (144, "icon-144x144.png"),
    (152, "icon-152x152.png"),
    (180, "apple-touch-icon.png"),
    (192, "icon-192x192.png"),
    (384, "icon-384x384.png"),
    (512, "icon-512x512.png"),
]

for size, name in SIZES:
    out_path = os.path.join("public", name)
    resized = canvas.resize((size, size), Image.LANCZOS)

    if size <= 32:
        # Favicon: pakai background putih supaya tidak transparan di browser
        bg = Image.new("RGB", (size, size), (255, 255, 255))
        bg.paste(resized, mask=resized.split()[3])
        bg.save(out_path, "PNG", optimize=True)
    else:
        resized.save(out_path, "PNG", optimize=True)

    print(f"  ✓ {name} ({size}x{size})")

# ── Buat favicon.ico ──────────────────────────────────────────────────────
ico_path = os.path.join("public", "favicon.ico")
ico_32 = canvas.resize((32, 32), Image.LANCZOS)
bg = Image.new("RGBA", (32, 32), (255, 255, 255, 255))
bg.paste(ico_32, mask=ico_32.split()[3])
bg.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32)])
print(f"  ✓ favicon.ico\n")

print("Selesai! Semua icon berhasil di-generate di folder public/")
print("Sekarang commit & deploy seperti biasa.")
