import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistem Pesantren Sukahideng",
  description: "Aplikasi Manajemen Terpadu Pesantren",
};

// PENTING: Jangan ada 'export const runtime = edge' untuk Vercel (kecuali butuh banget)
// Biarkan default (Node.js) agar Server Actions berjalan maksimal.

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
        
        {/* Script Excel CDN */}
        <Script 
          src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" 
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}