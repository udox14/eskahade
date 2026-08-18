import io, re

p = 'app/dashboard/keuangan-terpusat/payout/_payout-client.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        print('  LEWAT:', label)
        return
    s = s.replace(old, new)
    print('  ok   :', label)


rep("""  checkPayoutAction, checkPayoutsAction, createPayoutAction, executeApiPayoutAction, executePayoutAction,
  importPayoutsAction, importRecipientsAction, reconcilePayoutAction, reconcilePayoutsAction,""",
    """  approvePayoutAction, approvePayoutsAction, createPayoutAction, payApiPayoutAction, payPayoutAction,
  importPayoutsAction, importRecipientsAction,""", 'impor aksi')

# --- peta status ---
a = s.index("  { status: 'SUBMITTED'")
b = s.index("  { status: 'CANCELLED'")
b = s.index('\n', b) + 1
s = s[:a] + """  { status: 'DIAJUKAN', label: 'Menunggu persetujuan', owner: 'Checker', tone: 'amber' as const, next: 'Checker memeriksa lalu menyetujui.' },
  { status: 'DISETUJUI', label: 'Siap dibayar', owner: 'Checker', tone: 'blue' as const, next: 'Checker mengirim dana lalu mencatat buktinya.' },
  { status: 'DIPROSES', label: 'Sedang dikirim provider', owner: 'Provider', tone: 'blue' as const, next: 'Menunggu konfirmasi provider.' },
  { status: 'DIBAYAR', label: 'Selesai dibayar', owner: '—', tone: 'emerald' as const, next: 'Tidak ada tindakan lanjutan.' },
  { status: 'GAGAL', label: 'Gagal', owner: 'Maker', tone: 'red' as const, next: 'Periksa alasan kegagalan lalu ajukan ulang.' },
  { status: 'DIBATALKAN', label: 'Dibatalkan', owner: '—', tone: 'slate' as const, next: 'Tidak ada tindakan lanjutan.' },
""" + s[b:]
print('  ok   : peta status')

# --- masa tenang rekening ---
a = s.index('  /** Rekening masih dalam masa tenang')
b = s.index('\n', s.index('const until = new Date(row.usable_after || 0).getTime()'))
b = s.index('\n', b + 1) + 1
blok = s[a:b]
s = s[:a] + """  /** Rekening siap dipakai begitu diverifikasi petugas lain. Masa tenang 24 jam dihapus. */
  const recipientReady = (row: any) => row.status === 'ACTIVE'
""" + s[b:]
print('  ok   : masa tenang dibuang (blok %d karakter)' % len(blok))

rep("    : payouts.filter(row => !['RECONCILED', 'CANCELLED'].includes(row.status)), [payouts, statusFilter])",
    "    : payouts.filter(row => !['DIBAYAR', 'DIBATALKAN'].includes(row.status)), [payouts, statusFilter])", 'filter default')

rep("""    submitted: payouts.filter(row => row.status === 'SUBMITTED').length,
    checked: payouts.filter(row => row.status === 'CHECKED').length,
    inflight: payouts.filter(row => ['EXECUTING', 'PROVIDER_SUCCESS'].includes(row.status)).length,
    failed: payouts.filter(row => row.status === 'FAILED').length,""",
    """    submitted: payouts.filter(row => row.status === 'DIAJUKAN').length,
    checked: payouts.filter(row => row.status === 'DISETUJUI').length,
    inflight: payouts.filter(row => row.status === 'DIPROSES').length,
    failed: payouts.filter(row => row.status === 'GAGAL').length,""", 'ringkasan angka')

rep("  const selectableCheck = visiblePayouts.filter(row => row.status === 'SUBMITTED')",
    "  const selectableCheck = visiblePayouts.filter(row => row.status === 'DIAJUKAN')", 'selectableCheck')
rep("  const selectableReconcile = visiblePayouts.filter(row => row.status === 'PROVIDER_SUCCESS')",
    "  const selectableReconcile: any[] = []", 'selectableReconcile dikosongkan')
rep("(row.status === 'SUBMITTED' && capabilities.check)", "(row.status === 'DIAJUKAN' && capabilities.check)", 'canSelect')

io.open(p, 'w', encoding='utf-8').write(s)
print('tahap 1 selesai')
