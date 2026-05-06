This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Demo Account

App ini sekarang mendukung akun demo yang diarahkan ke database D1 terpisah.

Status saat ini:

- Binding `DEMO_DB` sudah ditambahkan ke [wrangler.jsonc](./wrangler.jsonc)
- Database Cloudflare `eskahade-demo` sudah dibuat dengan id `baad7149-8cc3-4971-8e0a-a8406645a0b4`
- Seed bootstrap ada di `scripts/demo-bootstrap.sql` dan dibangun dari semua file migration + `scripts/demo-seed.sql`

Environment lokal yang dipakai sekarang:

```txt
DEMO_LOGIN_ENABLED=true
DEMO_USER_EMAIL=demo@eskahade.local
DEMO_USER_PASSWORD=demo12345
DEMO_USER_NAME=Akun Demo
DEMO_USER_ROLE=admin
DEMO_USER_ROLES=["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]
```

Perintah yang dipakai untuk membangun dan mengisi database demo:

```bash
npm run demo:build-sql
npm run demo:apply
```

Penting:

- Akun demo tidak akan memakai `DB` utama.
- Jika `DEMO_DB` hilang atau belum terhubung, login demo akan gagal saat mulai mengakses dashboard.
- Struktur schema `DEMO_DB` harus mengikuti schema aplikasi utama agar semua halaman tetap jalan.
