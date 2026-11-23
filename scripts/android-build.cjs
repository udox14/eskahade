// Build APK/AAB Android ESKAHADE (Capacitor).
//
//   node scripts/android-build.cjs debug     → android/app/build/outputs/apk/debug/app-debug.apk
//   node scripts/android-build.cjs release   → APK rilis bertanda tangan (butuh keystore + Firebase)
//   node scripts/android-build.cjs bundle    → AAB untuk Play Store (butuh keystore + Firebase)
//
// Tooling: JAVA_HOME / ANDROID_HOME dari environment, atau folder ESKAHADE_ANDROID_TOOLS yang berisi
// jdk*/ dan android-sdk/ (mis. C:\DATA\mansatas-app\.tools). Domain: ESKAHADE_APP_URL (default produksi).
const { existsSync, readdirSync } = require('node:fs')
const { join, delimiter } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = join(__dirname, '..')
const androidDir = join(root, 'android')
const mode = process.argv[2] || 'debug'
const tasks = { debug: 'assembleDebug', release: 'assembleRelease', bundle: 'bundleRelease' }
if (!tasks[mode]) { console.error('Mode: debug | release | bundle'); process.exit(1) }

const env = { ...process.env }
const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH'
const toolsDir = env.ESKAHADE_ANDROID_TOOLS || join(root, '.tools')
if (!env.JAVA_HOME && existsSync(toolsDir)) {
  const jdkRoot = readdirSync(toolsDir).find(d => /^jdk/i.test(d) && !d.endsWith('.zip'))
  if (jdkRoot) {
    const base = join(toolsDir, jdkRoot)
    const nested = readdirSync(base).find(d => existsSync(join(base, d, 'bin')))
    env.JAVA_HOME = existsSync(join(base, 'bin')) ? base : join(base, nested || '')
  }
}
if (!env.ANDROID_HOME && existsSync(join(toolsDir, 'android-sdk'))) {
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = join(toolsDir, 'android-sdk')
}
if (env.JAVA_HOME) env[pathKey] = `${join(env.JAVA_HOME, 'bin')}${delimiter}${env[pathKey] || ''}`
if (!env.JAVA_HOME || !env.ANDROID_HOME) {
  console.error('JAVA_HOME (JDK 21) dan ANDROID_HOME wajib tersedia, atau set ESKAHADE_ANDROID_TOOLS.')
  process.exit(1)
}

const googleServices = join(androidDir, 'app', 'google-services.json')
const keystore = join(androidDir, 'keystore.properties')
if (mode !== 'debug') {
  // Rilis tanpa Firebase = APK tanpa notifikasi; tanpa keystore = tidak bisa dipasang/diperbarui.
  if (!existsSync(googleServices)) { console.error('android/app/google-services.json belum ada (unduh dari Firebase Console).'); process.exit(1) }
  if (!existsSync(keystore)) { console.error('android/keystore.properties belum ada (lihat docs/ANDROID_APK_FCM.md).'); process.exit(1) }
} else if (!existsSync(googleServices)) {
  console.warn('PERINGATAN: google-services.json tidak ada — APK debug berjalan tanpa notifikasi FCM.')
}

function run(command, args, cwd = root) {
  // Windows: .cmd/.bat wajib lewat shell; argumen di sini konstanta internal, dikutip eksplisit.
  const result = process.platform === 'win32'
    ? spawnSync([command, ...args].map(a => `"${a}"`).join(' '), { cwd, env, stdio: 'inherit', shell: true })
    : spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

run('node', [join(root, 'scripts', 'android-apply-branding.cjs')])
run(join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'cap.cmd' : 'cap'), ['sync', 'android'])
run(join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), [tasks[mode]], androidDir)
console.log(`\nSelesai (${mode}). Hasil ada di android/app/build/outputs/.`)
