import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistem Pesantren Sukahideng",
  description: "Aplikasi Manajemen Terpadu Pesantren",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <Toaster position="top-center" richColors />
        {/* 
          CATATAN: xlsx CDN Script dihapus karena tidak diperlukan.
          Semua halaman yang butuh xlsx sudah menggunakan dynamic import:
          const XLSX = await import('xlsx')
          Ini lebih optimal untuk bundle size Cloudflare Workers.
        */}
      </body>
    </html>
  );
}