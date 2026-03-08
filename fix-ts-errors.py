#!/usr/bin/env python3
"""
Fix all TypeScript build errors in eskahade Next.js project.
Run from the ROOT of the project:
  python3 fix-ts-errors.py
"""

import re, os, sys

BASE = os.getcwd()
ok = 0; fail = 0

def patch(path, old, new, label=""):
    global ok, fail
    full = os.path.join(BASE, path)
    if not os.path.exists(full):
        print(f"  ✗ FILE NOT FOUND: {path}")
        fail += 1
        return
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    if old not in src:
        print(f"  ✗ NOT FOUND ({label or old[:60]}): {path}")
        fail += 1
        return
    with open(full, "w", encoding="utf-8") as f:
        f.write(src.replace(old, new, 1))
    print(f"  ✓ {label or old[:60]}")
    ok += 1

def prepend(path, line):
    global ok, fail
    full = os.path.join(BASE, path)
    if not os.path.exists(full):
        print(f"  ✗ FILE NOT FOUND: {path}")
        fail += 1
        return
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    if line in src:
        print(f"  - Already has: {line[:50]} in {path}")
        return
    with open(full, "w", encoding="utf-8") as f:
        f.write(line + "\n" + src)
    print(f"  ✓ Prepended to {path}: {line[:50]}")
    ok += 1

def add_react_import(path):
    """Add 'import React from react' after 'use client' directive if not already present."""
    global ok, fail
    full = os.path.join(BASE, path)
    if not os.path.exists(full):
        print(f"  ✗ FILE NOT FOUND: {path}")
        fail += 1
        return
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    if "import React" in src or "import * as React" in src:
        print(f"  - Already has React import: {path}")
        return
    if "'use client'" in src:
        src = src.replace("'use client'\n", "'use client'\n\nimport React from 'react'\n", 1)
    elif '"use client"' in src:
        src = src.replace('"use client"\n', '"use client"\n\nimport React from \'react\'\n', 1)
    else:
        src = "import React from 'react'\n" + src
    with open(full, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"  ✓ Added React import: {path}")
    ok += 1

print("\n=== FIX 1: Add 'import React' to files using React namespace ===")
REACT_FILES = [
    "app/dashboard/akademik/grading/page.tsx",
    "app/dashboard/akademik/kenaikan/page.tsx",
    "app/dashboard/akademik/nilai/input/page.tsx",
    "app/dashboard/akademik/upk/kasir/page.tsx",
    "app/dashboard/asrama/absen-sakit/page.tsx",
    "app/dashboard/asrama/layanan/page.tsx",
    "app/dashboard/asrama/spp/page.tsx",
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "app/dashboard/dewan-santri/setoran/page.tsx",
    "app/dashboard/dewan-santri/surat/page.tsx",
    "app/dashboard/keamanan/input/page.tsx",
    "app/dashboard/keamanan/perizinan/page.tsx",
    "app/dashboard/keuangan/tarif/page.tsx",
    "app/dashboard/layout.tsx",
    "app/dashboard/master/kelas/page.tsx",
    "app/dashboard/master/kitab/page.tsx",
    "app/dashboard/master/wali-kelas/page.tsx",
    "app/dashboard/pengaturan/users/page.tsx",
    "app/dashboard/santri/atur-kelas/form-atur-kelas.tsx",
    "app/dashboard/santri/atur-kelas/import/page.tsx",
    "app/dashboard/santri/foto/page.tsx",
    "app/dashboard/santri/input/page.tsx",
    "app/dashboard/santri/santri-client.tsx",
    "app/dashboard/santri/tes-klasifikasi/page.tsx",
    "app/layout.tsx",
    "components/layout/client-layout.tsx",
    "components/layout/sidebar.tsx",
]
for f in REACT_FILES:
    add_react_import(f)

print("\n=== FIX 2: Add node types triple-slash to lib files ===")
for f in ["lib/auth/session.ts", "lib/r2/upload.ts", "tailwind.config.ts"]:
    prepend(f, '/// <reference types="node" />')

print("\n=== FIX 3: layout.tsx — session null + full_name column ===")
patch(
    "app/dashboard/layout.tsx",
    """  const user = await queryOne<{ nama_lengkap: string; role: string }>(
    'SELECT nama_lengkap, role FROM users WHERE id = ?',
    [session.id]
  );

  const userRole = user?.role || 'wali_kelas';
  const userName = user?.nama_lengkap || 'User';""",
    """  const s = session!;

  const user = await queryOne<{ full_name: string; role: string }>(
    'SELECT full_name, role FROM users WHERE id = ?',
    [s.id]
  );

  const userRole = user?.role || 'wali_kelas';
  const userName = user?.full_name || 'User';""",
    "session! + full_name column"
)

print("\n=== FIX 4: page.tsx — session possibly null ===")
patch(
    "app/dashboard/page.tsx",
    """  const role = session.role || 'wali_kelas'

  if (role === 'pengurus_asrama') {
    if (!session.asrama_binaan) {
      return <div className=\"p-10 text-center text-gray-500\">Anda belum ditugaskan ke asrama manapun. Hubungi Admin.</div>
    }
    return <AsramaDashboard asrama={session.asrama_binaan} />
  }""",
    """  const s = session!
  const role = s.role || 'wali_kelas'

  if (role === 'pengurus_asrama') {
    if (!s.asrama_binaan) {
      return <div className=\"p-10 text-center text-gray-500\">Anda belum ditugaskan ke asrama manapun. Hubungi Admin.</div>
    }
    return <AsramaDashboard asrama={s.asrama_binaan!} />
  }""",
    "session! assertion"
)

print("\n=== FIX 5: absensi/rekap/page.tsx — s.value ?? '' ===")
patch(
    "app/dashboard/akademik/absensi/rekap/page.tsx",
    "      if (s.type === 'ASRAMA') setFilterAsrama(s.value)\n      if (s.type === 'KELAS') setFilterKelas(s.value)",
    "      if (s.type === 'ASRAMA') setFilterAsrama(s.value ?? '')\n      if (s.type === 'KELAS') setFilterKelas(s.value ?? '')",
    "s.value ?? ''"
)

print("\n=== FIX 6: absensi/page.tsx — CellInput value type ===")
patch(
    "app/dashboard/akademik/absensi/page.tsx",
    "                                  value={val[session]} ",
    "                                  value={(val[session] as string) ?? 'H'} ",
    "CellInput value cast"
)

print("\n=== FIX 7: grading/page.tsx — grade: unknown ===")
patch(
    "app/dashboard/akademik/grading/page.tsx",
    "      const payload = Object.entries(pendingChanges).map(([id, grade]) => ({\n        riwayat_id: id,\n        grade: grade\n      }))",
    "      const payload = Object.entries(pendingChanges).map(([id, grade]) => ({\n        riwayat_id: id,\n        grade: grade as string\n      }))",
    "grade as string"
)

print("\n=== FIX 8: upk/kasir — actions return type + page items cast ===")
patch(
    "app/dashboard/akademik/upk/kasir/actions.ts",
    "export async function simpanTransaksiUPK(payload: any) {",
    "export async function simpanTransaksiUPK(payload: any): Promise<{ success: boolean } | { error: string }> {",
    "simpanTransaksiUPK return type"
)
patch(
    "app/dashboard/akademik/upk/kasir/page.tsx",
    "                        onClick={() => addPaket(items)}",
    "                        onClick={() => addPaket(items as any[])}",
    "addPaket items cast"
)
patch(
    "app/dashboard/akademik/upk/kasir/page.tsx",
    "                                    {items.map(k => {",
    "                                    {(items as any[]).map(k => {",
    "items.map cast"
)
patch(
    "app/dashboard/akademik/upk/kasir/page.tsx",
    "    if (res?.error) {\n        toast.error(res.error)",
    "    if ('error' in res) {\n        toast.error((res as any).error)",
    "res.error narrowing"
)

print("\n=== FIX 9: upk/manajemen — actions return types + page error checks ===")
patch(
    "app/dashboard/akademik/upk/manajemen/actions.ts",
    "export async function serahkanBarang(transaksiId: string) {",
    "export async function serahkanBarang(transaksiId: string): Promise<{ success: boolean } | { error: string }> {",
    "serahkanBarang return type"
)
patch(
    "app/dashboard/akademik/upk/manajemen/actions.ts",
    "export async function serahkanBarangPartial(itemIds: string[]) {",
    "export async function serahkanBarangPartial(itemIds: string[]): Promise<{ success: boolean } | { error: string }> {",
    "serahkanBarangPartial return type"
)
patch(
    "app/dashboard/akademik/upk/manajemen/actions.ts",
    "export async function selesaikanKeuangan(transaksiId: string, jenis: 'LUNAS' | 'AMBIL_KEMBALIAN') {",
    "export async function selesaikanKeuangan(transaksiId: string, jenis: 'LUNAS' | 'AMBIL_KEMBALIAN'): Promise<{ success: boolean } | { error: string }> {",
    "selesaikanKeuangan return type"
)
patch(
    "app/dashboard/akademik/upk/manajemen/page.tsx",
    "    if(res?.error) {\n          toast.error(res.error)",
    "    if('error' in res) {\n          toast.error((res as any).error)",
    "manajemen res.error narrowing 1"
)
patch(
    "app/dashboard/akademik/upk/manajemen/page.tsx",
    "    if(res?.error) toast.error(res.error)\n    else { toast.success(\"Hutang Lunas\"); loadDistribusi(); }",
    "    if('error' in res) toast.error((res as any).error)\n    else { toast.success(\"Hutang Lunas\"); loadDistribusi(); }",
    "manajemen res.error narrowing 2"
)
patch(
    "app/dashboard/akademik/upk/manajemen/page.tsx",
    "    if(res?.error) toast.error(res.error)\n    else { toast.success(\"Kembalian Diserahkan\"); loadDistribusi(); }",
    "    if('error' in res) toast.error((res as any).error)\n    else { toast.success(\"Kembalian Diserahkan\"); loadDistribusi(); }",
    "manajemen res.error narrowing 3"
)

print("\n=== FIX 10: uang-jajan — nominal types + actions return type ===")
patch(
    "app/dashboard/asrama/uang-jajan/actions.ts",
    "export async function simpanJajanMassal(listTransaksi: { santriId: string; nominal: number }[]) {",
    "export async function simpanJajanMassal(listTransaksi: { santriId: string; nominal: number }[]): Promise<{ success: boolean; count: number } | { error: string }> {",
    "simpanJajanMassal return type"
)
patch(
    "app/dashboard/asrama/uang-jajan/actions.ts",
    "export async function simpanTopup(santriId: string, nominal: number, keterangan: string) {",
    "export async function simpanTopup(santriId: string, nominal: number, keterangan: string): Promise<{ success: boolean } | { error: string }> {",
    "simpanTopup return type"
)
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "    const list = Object.entries(draftJajan).map(([id, nominal]) => ({ santriId: id, nominal }))",
    "    const list = (Object.entries(draftJajan) as [string, number][]).map(([id, nominal]) => ({ santriId: id, nominal }))",
    "draftJajan entries cast"
)
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "list.reduce((a,b)=>a+b.nominal, 0)",
    "list.reduce((a: number, b: {santriId: string; nominal: number})=>a+b.nominal, 0)",
    "list.reduce nominal type"
)
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "  const totalJajanDraft = Object.values(draftJajan).reduce((a, b) => a + b, 0)",
    "  const totalJajanDraft = Object.values(draftJajan).reduce((a: number, b: number) => a + b, 0)",
    "totalJajanDraft reduce type"
)
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "    if (res?.error) {\n        toast.error(\"Gagal\", { description: res.error })",
    "    if ('error' in res) {\n        toast.error(\"Gagal\", { description: (res as any).error })",
    "uang-jajan res.error narrowing"
)

print("\n=== FIX 11: spp/page.tsx — totalNominalDraft ===")
patch(
    "app/dashboard/asrama/spp/page.tsx",
    "  const totalNominalDraft = Object.values(drafts).reduce((a: any, b: any) => a + b.nominal, 0)",
    "  const totalNominalDraft = Object.values(drafts).reduce((a: number, b: any) => a + b.nominal, 0)",
    "totalNominalDraft reduce type"
)
patch(
    "app/dashboard/asrama/spp/actions.ts",
    "export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number) {",
    "export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {",
    "bayarSPP return type"
)
patch(
    "app/dashboard/asrama/spp/actions.ts",
    "export async function simpanSppBatch(listTransaksi: any[]) {",
    "export async function simpanSppBatch(listTransaksi: any[]): Promise<{ success: boolean; count: number } | { error: string }> {",
    "simpanSppBatch return type"
)

print("\n=== FIX 12: setoran/page.tsx — res.error narrowing ===")
patch(
    "app/dashboard/dewan-santri/setoran/actions.ts",
    "export async function batalkanSetoran(asrama: string, bulan: number, tahun: number) {",
    "export async function batalkanSetoran(asrama: string, bulan: number, tahun: number): Promise<{ success: boolean } | { error: string }> {",
    "batalkanSetoran return type"
)
# terimaSetoran has multi-line signature, patch the closing
patch(
    "app/dashboard/dewan-santri/setoran/actions.ts",
    "): Promise<void> {",
    "): Promise<{ success: boolean } | { error: string }> {",
    "terimaSetoran return type"
)

print("\n=== FIX 13: surat/actions.ts return types ===")
patch(
    "app/dashboard/dewan-santri/surat/actions.ts",
    "export async function catatSuratKeluar(santriId: string, jenis: string, detail: string) {",
    "export async function catatSuratKeluar(santriId: string, jenis: string, detail: string): Promise<{ success: boolean } | { error: string }> {",
    "catatSuratKeluar return type"
)
patch(
    "app/dashboard/dewan-santri/surat/actions.ts",
    "export async function hapusRiwayatSurat(id: string) {",
    "export async function hapusRiwayatSurat(id: string): Promise<{ success: boolean } | { error: string }> {",
    "hapusRiwayatSurat return type"
)

print("\n=== FIX 14: perizinan/actions.ts return types ===")
patch(
    "app/dashboard/keamanan/perizinan/actions.ts",
    "export async function simpanIzin(formData: FormData) {",
    "export async function simpanIzin(formData: FormData): Promise<{ success: boolean } | { error: string }> {",
    "simpanIzin return type"
)
patch(
    "app/dashboard/keamanan/perizinan/actions.ts",
    "export async function setSudahDatang(id: string, waktuDatang: string) {",
    "export async function setSudahDatang(id: string, waktuDatang: string): Promise<{ success: boolean; message: string } | { error: string }> {",
    "setSudahDatang return type"
)

print("\n=== FIX 15: verifikasi-telat/actions.ts return type ===")
# Fix the multi-line function signature
full = os.path.join(BASE, "app/dashboard/keamanan/perizinan/verifikasi-telat/actions.ts")
if os.path.exists(full):
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    # Find simpanVonisTelat and add return type
    src = re.sub(
        r'(export async function simpanVonisTelat\([^)]+\)) \{',
        r'\1: Promise<{ success: boolean; message?: string } | { error: string }> {',
        src
    )
    with open(full, "w", encoding="utf-8") as f:
        f.write(src)
    print("  ✓ simpanVonisTelat return type")
    ok += 1

print("\n=== FIX 16: keamanan/perizinan/cetak-telat — totalSantri curr unknown ===")
patch(
    "app/dashboard/keamanan/perizinan/cetak-telat/page.tsx",
    "  const totalSantri = data ? Object.values(data).reduce((acc, curr) => acc + curr.length, 0) : 0",
    "  const totalSantri = data ? Object.values(data).reduce((acc: number, curr: any) => acc + curr.length, 0) : 0",
    "totalSantri curr type"
)

print("\n=== FIX 17: tarif/actions.ts return type ===")
patch(
    "app/dashboard/keuangan/tarif/actions.ts",
    "export async function simpanTarif(tahun: number, tarifData: any) {",
    "export async function simpanTarif(tahun: number, tarifData: any): Promise<{ success: boolean } | { error: string }> {",
    "simpanTarif return type"
)

print("\n=== FIX 18: master/kitab/actions.ts return types ===")
patch(
    "app/dashboard/master/kitab/actions.ts",
    "export async function tambahKitab(formData: FormData) {",
    "export async function tambahKitab(formData: FormData): Promise<{ success: boolean } | { error: string }> {",
    "tambahKitab return type"
)
patch(
    "app/dashboard/master/kitab/actions.ts",
    "export async function hapusKitab(id: string) {",
    "export async function hapusKitab(id: string): Promise<{ success: boolean } | { error: string }> {",
    "hapusKitab return type"
)
patch(
    "app/dashboard/master/kitab/actions.ts",
    "export async function updateHargaKitab(id: string, hargaBaru: number) {",
    "export async function updateHargaKitab(id: string, hargaBaru: number): Promise<{ success: boolean } | { error: string }> {",
    "updateHargaKitab return type"
)
patch(
    "app/dashboard/master/kitab/actions.ts",
    "export async function importKitabMassal(dataExcel: any[]) {",
    "export async function importKitabMassal(dataExcel: any[]): Promise<{ success: boolean; count: number; failed: number } | { error: string }> {",
    "importKitabMassal return type"
)

print("\n=== FIX 19: master/kitab/page.tsx — res.success / res.error narrowing ===")
patch(
    "app/dashboard/master/kitab/page.tsx",
    "    if (res?.error) { toast.error(res.error)",
    "    if ('error' in res) { toast.error((res as any).error)",
    "kitab page res.error narrowing"
)

print("\n=== FIX 20: master/wali-kelas/actions.ts return types ===")
patch(
    "app/dashboard/master/wali-kelas/actions.ts",
    "export async function tambahGuruManual(nama: string, gelar: string, kode: string) {",
    "export async function tambahGuruManual(nama: string, gelar: string, kode: string): Promise<{ success: boolean } | { error: string }> {",
    "tambahGuruManual return type"
)
patch(
    "app/dashboard/master/wali-kelas/actions.ts",
    "export async function hapusGuru(id: string) {",
    "export async function hapusGuru(id: string): Promise<{ success: boolean } | { error: string }> {",
    "hapusGuru return type"
)
patch(
    "app/dashboard/master/wali-kelas/actions.ts",
    "export async function hapusGuruBatch(ids: string[]) {",
    "export async function hapusGuruBatch(ids: string[]): Promise<{ success: boolean; count: number } | { error: string }> {",
    "hapusGuruBatch return type"
)
patch(
    "app/dashboard/master/wali-kelas/actions.ts",
    "export async function importDataGuru(dataExcel: any[]) {",
    "export async function importDataGuru(dataExcel: any[]): Promise<{ success: boolean; count: number; skipped: number; allDuplicate?: boolean } | { error: string }> {",
    "importDataGuru return type"
)

print("\n=== FIX 21: pengaturan/users/actions.ts return types ===")
patch(
    "app/dashboard/pengaturan/users/actions.ts",
    "export async function updateUserRole(id: string, newRole: string, asrama?: string) {",
    "export async function updateUserRole(id: string, newRole: string, asrama?: string): Promise<{ success: boolean } | { error: string }> {",
    "updateUserRole return type"
)
patch(
    "app/dashboard/pengaturan/users/actions.ts",
    "export async function createUser(formData: FormData) {",
    "export async function createUser(formData: FormData): Promise<{ success: boolean } | { error: string }> {",
    "createUser return type"
)
patch(
    "app/dashboard/pengaturan/users/actions.ts",
    "export async function updateUserDetails(userId: string, fullName: string, email: string) {",
    "export async function updateUserDetails(userId: string, fullName: string, email: string): Promise<{ success: boolean } | { error: string }> {",
    "updateUserDetails return type"
)
patch(
    "app/dashboard/pengaturan/users/actions.ts",
    "export async function resetUserPassword(userId: string, newPassword: string) {",
    "export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean } | { error: string }> {",
    "resetUserPassword return type"
)
patch(
    "app/dashboard/pengaturan/users/actions.ts",
    "export async function deleteUser(userId: string) {",
    "export async function deleteUser(userId: string): Promise<{ success: boolean } | { error: string }> {",
    "deleteUser return type"
)

print("\n=== FIX 22: santri/arsip/actions.ts return types ===")
patch(
    "app/dashboard/santri/arsip/actions.ts",
    "export async function arsipkanSantri(santriIds: string[], catatan: string) {",
    "export async function arsipkanSantri(santriIds: string[], catatan: string): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {",
    "arsipkanSantri return type"
)
patch(
    "app/dashboard/santri/arsip/actions.ts",
    "export async function restoreSantri(arsipIds: string[]) {",
    "export async function restoreSantri(arsipIds: string[]): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {",
    "restoreSantri return type"
)
patch(
    "app/dashboard/santri/arsip/actions.ts",
    "export async function hapusArsipPermanen(arsipId: string) {",
    "export async function hapusArsipPermanen(arsipId: string): Promise<{ success: boolean } | { error: string }> {",
    "hapusArsipPermanen return type"
)
patch(
    "app/dashboard/santri/arsip/actions.ts",
    "export async function hapusArsipMassal(arsipIds: string[]) {",
    "export async function hapusArsipMassal(arsipIds: string[]): Promise<{ success: boolean; count: number } | { error: string }> {",
    "hapusArsipMassal return type"
)
patch(
    "app/dashboard/santri/arsip/actions.ts",
    "export async function getArsipForDownload(arsipIds?: string[]) {",
    "export async function getArsipForDownload(arsipIds?: string[]): Promise<{ data: any[] } | { error: string }> {",
    "getArsipForDownload return type"
)

print("\n=== FIX 23: santri/arsip/page.tsx — NodeJS.Timeout + selectedRestore + download narrowing ===")
patch(
    "app/dashboard/santri/arsip/page.tsx",
    "NodeJS.Timeout",
    "ReturnType<typeof setTimeout>",
    "NodeJS.Timeout -> ReturnType"
)
patch(
    "app/dashboard/santri/arsip/page.tsx",
    "    const ids = selectedRestore.size > 0 ? Array.from(selectedRestore) : undefined",
    "    const ids = selectedRestore.size > 0 ? Array.from(selectedRestore) as string[] : undefined",
    "selectedRestore as string[]"
)
patch(
    "app/dashboard/santri/arsip/page.tsx",
    "    if (res.error || !res.data) { toast.error(\"Gagal\", { description: res.error }); return }",
    "    if ('error' in res || !('data' in res)) { toast.error(\"Gagal\", { description: (res as any).error }); return }",
    "arsip download res narrowing"
)
# Also fix hapusArsipPermanen res check
patch(
    "app/dashboard/santri/arsip/page.tsx",
    "    if (res?.error) { toast.error(\"Gagal hapus\"); return }",
    "    if ('error' in res) { toast.error(\"Gagal hapus\"); return }",
    "hapusSatu res.error narrowing"
)

print("\n=== FIX 24: santri/tes-klasifikasi/actions.ts return type ===")
patch(
    "app/dashboard/santri/tes-klasifikasi/actions.ts",
    "export async function simpanTes(formData: FormData) {",
    "export async function simpanTes(formData: FormData): Promise<{ success: boolean } | { error: string }> {",
    "simpanTes return type"
)

print("\n=== FIX 25: sidebar.tsx — THEME_COLORS type ===")
patch(
    "components/layout/sidebar.tsx",
    "  const c = mounted ? THEME_COLORS[theme] : THEME_COLORS['emerald'];",
    "  const c = mounted ? THEME_COLORS[theme as ThemeKey] : THEME_COLORS['emerald'];",
    "THEME_COLORS cast"
)

print("\n=== FIX 26: Apply res.error narrowing to all remaining pages ===")
# For pages that check res?.error where the action now returns union type
# We use ('error' in res) pattern everywhere

pages_with_res_error = [
    # (file, old_pattern, new_pattern)
    ("app/dashboard/dewan-santri/setoran/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/dewan-santri/surat/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/dewan-santri/surat/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/keamanan/perizinan/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/keamanan/perizinan/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/keamanan/perizinan/verifikasi-telat/page.tsx",
     "    if (res?.error) {\n      toast.error(\"Gagal\", { description: res.error })",
     "    if ('error' in res) {\n      toast.error(\"Gagal\", { description: (res as any).error })"),
    ("app/dashboard/keuangan/tarif/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/keuangan/tarif/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/master/wali-kelas/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/master/wali-kelas/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/pengaturan/users/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/pengaturan/users/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/santri/tes-klasifikasi/page.tsx",
     "    if (res?.error) {\n      toast.error(res.error)",
     "    if ('error' in res) {\n      toast.error((res as any).error)"),
    ("app/dashboard/santri/tes-klasifikasi/page.tsx",
     "    if (res?.error) { toast.error(",
     "    if ('error' in res) { toast.error("),
    ("app/dashboard/asrama/uang-jajan/page.tsx",
     "    if (res?.error) {\n        toast.error(\"Gagal\", { description: res.error })",
     "    if ('error' in res) {\n        toast.error(\"Gagal\", { description: (res as any).error })"),
]

for filepath, old, new in pages_with_res_error:
    full = os.path.join(BASE, filepath)
    if not os.path.exists(full):
        continue
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    if old in src:
        src = src.replace(old, new, 1)
        with open(full, "w", encoding="utf-8") as f:
            f.write(src)
        print(f"  ✓ {filepath.split('/')[-2]}: {old[:50]}")
        ok += 1
    # Also do a global regex replace for remaining res?.error patterns
    src_new = re.sub(r'if \(res\?\.error\)', "if ('error' in res)", src)
    src_new = re.sub(r'res\.error\b', "(res as any).error", src_new)
    if src_new != src:
        with open(full, "w", encoding="utf-8") as f:
            f.write(src_new)
        print(f"  ✓ {filepath.split('/')[-2]}: regex cleanup res.error")
        ok += 1

# Apply global regex cleanup to ALL affected pages
ALL_PAGES = [
    "app/dashboard/akademik/upk/kasir/page.tsx",
    "app/dashboard/akademik/upk/manajemen/page.tsx",
    "app/dashboard/asrama/spp/page.tsx",
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "app/dashboard/dewan-santri/setoran/page.tsx",
    "app/dashboard/dewan-santri/surat/page.tsx",
    "app/dashboard/keamanan/perizinan/page.tsx",
    "app/dashboard/keamanan/perizinan/verifikasi-telat/page.tsx",
    "app/dashboard/keuangan/tarif/page.tsx",
    "app/dashboard/master/kitab/page.tsx",
    "app/dashboard/master/wali-kelas/page.tsx",
    "app/dashboard/pengaturan/users/page.tsx",
    "app/dashboard/santri/arsip/page.tsx",
    "app/dashboard/santri/tes-klasifikasi/page.tsx",
]
for filepath in ALL_PAGES:
    full = os.path.join(BASE, filepath)
    if not os.path.exists(full): continue
    with open(full, "r", encoding="utf-8") as f:
        src = f.read()
    changed = False
    # Replace res?.error checks
    new_src = re.sub(r"if \(res\?\.error\)", "if ('error' in res)", src)
    if new_src != src: changed = True; src = new_src
    # Replace res.success / res.count / res.berhasil etc after narrowing - cast to any
    for prop in ['count', 'berhasil', 'gagal', 'errors', 'message', 'skipped', 'allDuplicate', 'failed']:
        new_src = src.replace(f'res.{prop}', f'(res as any).{prop}')
        if new_src != src: changed = True; src = new_src
    if changed:
        with open(full, "w", encoding="utf-8") as f:
            f.write(src)

print(f"\n{'='*50}")
print(f"Done! ✓ {ok} fixed, ✗ {fail} failed")
print(f"\nNow run: npx opennextjs-cloudflare build")


# ============================================================
# ADDITIONAL FIXES (part 2 - run after part 1)
# ============================================================

print("\n=== FIX 27: uang-jajan totalJajanDraft explicit type ===")
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "  const totalJajanDraft = Object.values(draftJajan).reduce((a: number, b: number) => a + b, 0)",
    "  const totalJajanDraft: number = (Object.values(draftJajan) as number[]).reduce((a: number, b: number) => a + b, 0)",
    "totalJajanDraft explicit type"
)

print("\n=== FIX 28: uang-jajan sortedKamars cast ===")
patch(
    "app/dashboard/asrama/uang-jajan/page.tsx",
    "  const sortedKamars = Object.keys(groupedData).sort((a, b) => (parseInt(a)||999) - (parseInt(b)||999))",
    "  const sortedKamars = (Object.keys(groupedData) as string[]).sort((a: string, b: string) => (parseInt(a)||999) - (parseInt(b)||999))",
    "sortedKamars cast"
)

print("\n=== FIX 29: Fix res?.success and res?.error with (res as any) cast ===")

def fix_res_any(path):
    full = os.path.join(BASE, path)
    if not os.path.exists(full): return
    with open(full, "r", encoding="utf-8") as f: src = f.read()
    original = src
    src = re.sub(r'if \(res\?\.success\)', "if ((res as any).success)", src)
    src = re.sub(r'if \(res\?\.error\)', "if ((res as any).error)", src)
    src = re.sub(r'\bres\?\.success\b', "(res as any).success", src)
    src = re.sub(r'\bres\?\.error\b', "(res as any).error", src)
    if src != original:
        with open(full, "w", encoding="utf-8") as f: f.write(src)
        print(f"  ✓ {path}")

for p in [
    "app/dashboard/dewan-santri/setoran/page.tsx",
    "app/dashboard/master/kitab/page.tsx",
    "app/dashboard/master/wali-kelas/page.tsx",
]:
    fix_res_any(p)

print("\n=== FIX 30: absensi/page.tsx - CellInput key prop + component fix ===")
patch(
    "app/dashboard/akademik/absensi/page.tsx",
    "                                  key={session}\n                                  id={cellId}",
    "                                  key={session as string}\n                                  id={cellId}",
    "key={session as string}"
)
patch(
    "app/dashboard/akademik/absensi/page.tsx",
    """}: { 
  id: string,
  value: string, 
  isHoliday: boolean,
  onChange: (v: string) => void,
  onKeyDown: (e: React.KeyboardEvent) => void
})""",
    """}: { 
  key?: React.Key,
  id: string,
  value: string, 
  isHoliday: boolean,
  onChange: (v: string) => void,
  onKeyDown: (e: React.KeyboardEvent) => void
})""",
    "CellInput key? prop"
)

print(f"\n{'='*50}")
print(f"All done! ✓ {ok} total fixes applied")
print(f"\nNow run: npx opennextjs-cloudflare build")