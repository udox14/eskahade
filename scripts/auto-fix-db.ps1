Write-Host "Mulai menjalankan auto-fix tiap 5 menit..."
while ($true) {
    Write-Host "Menjalankan update D1 di production..."
    cmd /c npx wrangler d1 execute eskahade-db --remote --command="UPDATE upk_antrian SET total_bayar = total_tagihan WHERE kembalian_ditahan = 0 AND total_bayar > total_tagihan AND status = 'SELESAI';"
    Write-Host "Selesai update. Menunggu 5 menit..."
    Start-Sleep -Seconds 300
}
