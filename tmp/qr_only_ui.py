import io, re

p = 'app/dashboard/keuangan-terpusat/kredensial/_credential-client.tsx'
s = io.open(p, encoding='utf-8').read()


def cut(start_marker, end_marker, label, include_end=False):
    """Potong dari start_marker sampai end_marker."""
    global s
    a = s.find(start_marker)
    if a < 0:
        print('  LEWAT (start tidak ketemu):', label)
        return
    b = s.find(end_marker, a)
    if b < 0:
        print('  LEWAT (end tidak ketemu):', label)
        return
    s = s[:a] + s[b + (len(end_marker) if include_end else 0):]
    print('  potong:', label)


def sub(old, new, label):
    global s
    if old not in s:
        print('  LEWAT:', label)
        return
    s = s.replace(old, new, 1)
    print('  ganti :', label)


# --- panel mode kredensial global ---
cut('      <div data-tour="mode" className="rounded-xl border bg-white p-4">',
    '      <div className="rounded-xl border bg-white p-4">\n        <div className="flex items-center gap-2"><Scan',
    'panel mode global')
sub('<section className="grid gap-4 xl:grid-cols-[1fr_1.25fr]" role="tabpanel">',
    '<section className="grid gap-4" role="tabpanel">', 'layout settings jadi satu kolom')

# --- dialog konfirmasi mode ---
cut('    <ConfirmAction\n      open={confirmMode}', '  </div>\n}', 'dialog konfirmasi mode')
s = s.rstrip() + '\n  </div>\n}\n'

# --- tab panel RFID ---
cut("    {activeTab === 'rfid' ? <div role=\"tabpanel\">", "    {activeTab === 'qr' ?", 'tab panel RFID')

# --- state & handler RFID/mode ---
for pat, label in [
    (r"  const \[mode, setMode\] = useState<CredentialMode>\(initialMode\)\n", 'state mode'),
    (r"  const \[from, setFrom\] = useState<'RFID' \| 'QR'>\('RFID'\)\n", 'state from'),
    (r"  const \[ends, setEnds\] = useState\(''\)\n", 'state ends'),
    (r"  const \[confirmMode, setConfirmMode\] = useState\(false\)\n", 'state confirmMode'),
    (r"  const \[rfidQueue, setRfidQueue\] = useState<CredentialStudentRow\[\]>\(\[\]\)\n", 'state rfidQueue'),
    (r"  const \[rfidIndex, setRfidIndex\] = useState\(0\)\n", 'state rfidIndex'),
    (r"  const \[rfidValue, setRfidValue\] = useState\(''\)\n", 'state rfidValue'),
    (r"  const \[isRfidFocused, setIsRfidFocused\] = useState\(true\)\n", 'state isRfidFocused'),
    (r"  const rfidInput = useRef<HTMLInputElement>\(null\)\n", 'ref rfidInput'),
    (r"  const currentRfid = rfidQueue\[rfidIndex\] \|\| null\n", 'currentRfid'),
]:
    s2 = re.sub(pat, '', s)
    print(('  potong: ' if s2 != s else '  LEWAT: ') + label)
    s = s2

cut('  const enrollRfid = useCallback(async (raw: string) => {', '  useKeyboardWedgeScanner', 'enrollRfid')
cut('  const applyMode = () => startTransition(async () => {', '  const runBatch =', 'applyMode')
cut('  const startRfidQueue = () => startTransition(async () => {', '  const ', 'startRfidQueue')
cut('''  useEffect(() => {
    if (rfidQueue.length) rfidInput.current?.focus()
  }, [rfidIndex, rfidQueue.length])
''', '\n', 'efek fokus rfid', include_end=True)

# --- tab RFID di daftar tab ---
s = re.sub(r"    \{ id: 'rfid', label: 'RFID'[^\n]*\n", '', s)
sub("type CredentialTab = 'enrollment' | 'rfid' | 'qr' | 'cards' | 'settings'",
    "type CredentialTab = 'enrollment' | 'qr' | 'cards' | 'settings'", 'tipe tab')

# --- tombol antrean RFID ---
s = re.sub(r"            <button onClick=\{startRfidQueue\}[^\n]*\n(?:[^\n]*\n)*?            </button>\n", '', s)

# --- kolom RFID di tabel ---
s = re.sub(r"            <div className=\"flex items-center gap-2 text-xs\"><span>RFID</span>\{badge\(row\.rfid_status\)\}</div>\n", '', s)

# --- import & tipe ---
sub("  getRfidEnrollmentQueueAction, issueCredentialAction, processQrBatchAction, searchCredentialStudents,",
    "  issueCredentialAction, processQrBatchAction, searchCredentialStudents,", 'import aksi')
s = re.sub(r"import type \{ CredentialMode \} from '@/lib/finance/types'\n", '', s)
sub("  id: string; santri_id: string; credential_kind: 'RFID_UID' | 'QR_STATIC'",
    "  id: string; santri_id: string; credential_kind: 'QR_STATIC'", 'tipe credential_kind')

io.open(p, 'w', encoding='utf-8').write(s)
print('\nselesai')
