// Membuat ikon launcher & splash Android dari public/icon-512x512.png (Windows: System.Drawing).
// Warna latar ikon adaptif & splash diambil dari piksel pojok logo agar menyatu.
const { existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = join(__dirname, '..')
const icon = join(root, 'public', 'icon-512x512.png')
const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

if (process.platform !== 'win32') {
  console.log('Branding dilewati: script ini memakai System.Drawing (Windows). Ikon bawaan dipakai.')
  process.exit(0)
}
if (!existsSync(icon)) throw new Error(`Logo tidak ditemukan: ${icon}`)
if (!existsSync(resDir)) throw new Error('Folder android/ belum ada. Jalankan "npx cap add android" terlebih dahulu.')

const ps = value => String(value).replace(/'/g, "''")
const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @($bmp, $g)
}

function Save-Png($bmp, [string]$path) {
  $tmp = "$path.$([Guid]::NewGuid().ToString('N')).tmp"
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

function Draw-Centered($g, $src, [int]$w, [int]$h, [double]$scale) {
  $size = [Math]::Floor([Math]::Min($w, $h) * $scale)
  $g.DrawImage($src, [int](($w - $size) / 2), [int](($h - $size) / 2), [int]$size, [int]$size)
}

$src = [System.Drawing.Image]::FromFile('${ps(icon)}')
$bg = ([System.Drawing.Bitmap]$src).GetPixel(3, 3)
$res = '${ps(resDir)}'

$launcher = @{ 'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96; 'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192 }
foreach ($e in $launcher.GetEnumerator()) {
  $dir = Join-Path $res $e.Key
  New-Item -ItemType Directory -Force $dir | Out-Null
  $s = $e.Value
  # Ikon lama (persegi): logo penuh.
  $c = New-Canvas $s $s; $c[1].Clear($bg); Draw-Centered $c[1] $src $s $s 1.0; $c[1].Dispose(); Save-Png $c[0] (Join-Path $dir 'ic_launcher.png')
  # Ikon bulat.
  $c = New-Canvas $s $s; $c[1].Clear([System.Drawing.Color]::Transparent)
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath; $clip.AddEllipse(0, 0, $s, $s); $c[1].SetClip($clip)
  $c[1].Clear($bg); Draw-Centered $c[1] $src $s $s 1.0; $clip.Dispose(); $c[1].Dispose(); Save-Png $c[0] (Join-Path $dir 'ic_launcher_round.png')
  # Lapisan depan ikon adaptif (108dp, area aman 66%).
  $f = [int]($s * 108 / 48)
  $c = New-Canvas $f $f; $c[1].Clear([System.Drawing.Color]::Transparent); Draw-Centered $c[1] $src $f $f 0.66; $c[1].Dispose(); Save-Png $c[0] (Join-Path $dir 'ic_launcher_foreground.png')
}

$splash = @{
  'drawable' = @(480, 800); 'drawable-port-mdpi' = @(320, 480); 'drawable-port-hdpi' = @(480, 800); 'drawable-port-xhdpi' = @(720, 1280)
  'drawable-port-xxhdpi' = @(960, 1600); 'drawable-port-xxxhdpi' = @(1280, 1920); 'drawable-land-mdpi' = @(480, 320)
  'drawable-land-hdpi' = @(800, 480); 'drawable-land-xhdpi' = @(1280, 720); 'drawable-land-xxhdpi' = @(1600, 960); 'drawable-land-xxxhdpi' = @(1920, 1280)
}
foreach ($e in $splash.GetEnumerator()) {
  $dir = Join-Path $res $e.Key
  New-Item -ItemType Directory -Force $dir | Out-Null
  $w = $e.Value[0]; $h = $e.Value[1]
  $c = New-Canvas $w $h; $c[1].Clear($bg); Draw-Centered $c[1] $src $w $h 0.42; $c[1].Dispose(); Save-Png $c[0] (Join-Path $dir 'splash.png')
}

$src.Dispose()
Write-Output ('#{0:X2}{1:X2}{2:X2}' -f $bg.R, $bg.G, $bg.B)
`

const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { cwd: root, encoding: 'utf8' })
if (result.status !== 0) {
  process.stderr.write(result.stderr || '')
  process.exit(result.status || 1)
}
const color = (result.stdout.trim().split(/\r?\n/).pop() || '#0B4D2B').toUpperCase()
if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error('Warna latar ikon tidak terbaca.')
writeFileSync(join(resDir, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${color}</color>\n</resources>\n`)
console.log(`Branding Android diterapkan (latar ${color}).`)
