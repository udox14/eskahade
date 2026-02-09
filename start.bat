@echo off
title Sistem Pesantren Sukahideng
color 0A

echo ========================================================
echo    MENYALAKAN SERVER PESANTREN SUKAHIDENG...
echo ========================================================
echo.

:: 1. Pindah ke folder project (Gunakan tanda kutip karena ada spasi)
cd /d "C:\DATA\Sukahideng App Codes\sukahideng-app"

:: 2. Buka browser otomatis (Tunggu 3 detik biar server siap dulu)
echo Membuka Google Chrome dalam 3 detik...
timeout /t 3 >nul
start http://localhost:3000

:: 3. Jalankan Server Next.js
echo.
echo Server sedang berjalan...
echo JANGAN TUTUP JENDELA HITAM INI selama aplikasi dipakai.
echo.
npm run dev

:: Jika error, jangan langsung tutup biar terbaca
pause