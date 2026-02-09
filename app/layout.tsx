import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistem Pesantren Sukahideng",
  description: "Aplikasi Manajemen Terpadu Pesantren",
};

// --- WAJIB: Konfigurasi untuk Cloudflare Pages ---
export const runtime = 'edge';
// ------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        {/* Pasang Toaster disini agar aktif di seluruh aplikasi */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}