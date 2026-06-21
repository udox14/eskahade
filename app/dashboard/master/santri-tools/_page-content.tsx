'use client'

import { useState, useEffect } from 'react'
import {
  previewNaikKelas, eksekusiNaikKelas,
  getSantriPembebasan, setBebas,
  catatBebasPembayaran, hapusBebasPembayaran,
  getSekolahList,
} from './actions'
import {
  ArrowUpCircle, ShieldCheck, Search, CheckSquare,
  Square, AlertTriangle, X, ChevronDown, ChevronUp, Banknote,
} from 'lucide-react'
import {
  Alert, Badge, Box, Button, Center, Checkbox, Flex, Grid, Group, Loader, Modal,
  NativeSelect, Paper, SegmentedControl, SimpleGrid, Stack, Text, TextInput, UnstyledButton,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ['', 'AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const JENIS_BIAYA_LIST = ['KESEHATAN', 'EHB', 'EKSKUL', 'BANGUNAN']

const STATUS_MCOLOR: Record<string, string> = {
  naik: 'green',
  lulus_sltp: 'blue',
  lulus_slta: 'grape',
  tidak_diketahui: 'gray',
}
const STATUS_LABEL: Record<string, string> = {
  naik: 'Naik Kelas',
  lulus_sltp: 'Lulus SLTP → SLTA',
  lulus_slta: 'Lulus SLTA',
  tidak_diketahui: 'Format Tidak Dikenal',
}

type Tab = 'naik_kelas' | 'pembebasan'

export default function SantriToolsPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('naik_kelas')

  // ── TAB NAIK KELAS ─────────────────────────────────────────────────────
  const [filterAsrama, setFilterAsrama] = useState('')
  const [filterSekolah, setFilterSekolah] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [sekolahList, setSekolahList] = useState<string[]>([])
  const [preview, setPreview] = useState<any[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [eksekusiLoading, setEksekusiLoading] = useState(false)
  const [showTidakDikenal, setShowTidakDikenal] = useState(false)

  // ── TAB PEMBEBASAN ─────────────────────────────────────────────────────
  const [pbAsrama, setPbAsrama] = useState('')
  const [pbSearch, setPbSearch] = useState('')
  const [pbHanyaBebas, setPbHanyaBebas] = useState(false)
  const [pbData, setPbData] = useState<any[]>([])
  const [pbLoading, setPbLoading] = useState(false)
  const [pbSelected, setPbSelected] = useState<Set<string>>(new Set())
  const [pbTahun, setPbTahun] = useState(new Date().getFullYear())
  const [modalSantri, setModalSantri] = useState<any | null>(null)

  useEffect(() => {
    getSekolahList().then(setSekolahList)
  }, [])

  useEffect(() => {
    if (tab === 'pembebasan' && pbData.length === 0 && !pbLoading) {
      loadPembebasan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Naik Kelas ─────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setLoadingPreview(true)
    setPreview(null)
    setSelectedIds(new Set())
    const res = await previewNaikKelas({ asrama: filterAsrama || undefined, sekolah: filterSekolah || undefined, kelasSekolah: filterKelas || undefined })
    if ('error' in res) { toast.error(res.error as string); setLoadingPreview(false); return }
    setPreview(res)
    const autoSelect = new Set(res.filter(s => s.status !== 'tidak_diketahui').map(s => s.id))
    setSelectedIds(autoSelect)
    setLoadingPreview(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSelected) ids.forEach(id => n.delete(id))
      else ids.forEach(id => n.add(id))
      return n
    })
  }

  const handleEksekusi = async () => {
    if (!selectedIds.size) return
    if (!await confirm(`Naikkan kelas sekolah ${selectedIds.size} santri? Tindakan ini tidak bisa dibatalkan secara massal.`)) return
    setEksekusiLoading(true)
    const res = await eksekusiNaikKelas([...selectedIds])
    setEksekusiLoading(false)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${(res as any).updated} santri berhasil dinaikkan kelasnya!`)
    setPreview(null)
    setSelectedIds(new Set())
  }

  const grouped = preview ? {
    naik: preview.filter(s => s.status === 'naik'),
    lulus_sltp: preview.filter(s => s.status === 'lulus_sltp'),
    lulus_slta: preview.filter(s => s.status === 'lulus_slta'),
    tidak_diketahui: preview.filter(s => s.status === 'tidak_diketahui'),
  } : null

  // ── Pembebasan ──────────────────────────────────────────────────────────
  const loadPembebasan = async () => {
    setPbLoading(true)
    setPbData([])
    setPbSelected(new Set())
    try {
      const res = await getSantriPembebasan({
        asrama: pbAsrama || undefined,
        search: pbSearch || undefined,
        hanyaBebasSpp: pbHanyaBebas,
        tahun: pbTahun,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setPbData(res)
    } catch (err) {
      console.error('[santri-tools] loadPembebasan ERROR:', err)
      toast.error('Gagal memuat data pembebasan pembayaran.')
    } finally {
      setPbLoading(false)
    }
  }

  const handleToggleBebas = async (ids: string[], bebas: boolean) => {
    const res = await setBebas(ids, bebas)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${(res as any).updated} santri ${bebas ? 'dibebaskan dari' : 'dikenakan kembali'} SPP`)
    loadPembebasan()
  }

  const handleCatatBebas = async (santriId: string, jenis: string) => {
    const res = await catatBebasPembayaran(santriId, jenis, pbTahun, '')
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`${jenis} tahun ${pbTahun} dicatat bebas`)
    const updated = await getSantriPembebasan({ asrama: pbAsrama || undefined, search: modalSantri?.nis, tahun: pbTahun })
    if (!('error' in updated) && updated.length) setModalSantri(updated[0])
    loadPembebasan()
  }

  const handleHapusBebas = async (santriId: string, jenis: string) => {
    const res = await hapusBebasPembayaran(santriId, jenis, pbTahun)
    if ('error' in res) { toast.error(res.error as string); return }
    toast.success(`Pembebasan ${jenis} dihapus`)
    const updated = await getSantriPembebasan({ asrama: pbAsrama || undefined, search: modalSantri?.nis, tahun: pbTahun })
    if (!('error' in updated) && updated.length) setModalSantri(updated[0])
    loadPembebasan()
  }

  return (
    <div className="pb-20 space-y-6">
      {/* HEADER */}
      <Box pb="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <DashboardPageHeader
          title="Manajemen Santri"
          description="Operasi massal data santri, naik kelas sekolah, dan manajemen pembebasan."
        />
      </Box>

      {/* TABS */}
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        data={[
          { value: 'naik_kelas', label: <Group gap={6} wrap="nowrap"><ArrowUpCircle className="w-4 h-4" /> Naik Kelas Sekolah</Group> },
          { value: 'pembebasan', label: <Group gap={6} wrap="nowrap"><ShieldCheck className="w-4 h-4" /> Pembebasan Pembayaran</Group> },
        ]}
      />

      {/* TAB 1: NAIK KELAS SEKOLAH */}
      {tab === 'naik_kelas' && (
        <Stack gap="md">
          <Alert color="yellow" variant="light" radius="md" icon={<AlertTriangle className="w-5 h-5" />} title="Cara Kerja">
            <Text size="sm" c="yellow.8">Sistem akan menaikkan angka di depan kelas sekolah (+1). Contoh: <code>7A → 8A</code>, <code>9 → 10</code>.</Text>
            <Text size="sm" c="yellow.8" mt={4}>Santri kelas <strong>12 dianggap lulus</strong> — kolom kelas sekolahnya akan dikosongkan. Santri kelas <strong>9 naik ke 10</strong> (lulus SLTP, masuk SLTA).</Text>
            <Text size="sm" fw={600} c="yellow.7" mt={4}>Pastikan filter sudah tepat sebelum eksekusi. Preview dulu sebelum menyimpan!</Text>
          </Alert>

          {/* Filter */}
          <Paper withBorder radius="md" p="md">
            <Grid gutter="md" align="flex-end">
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <NativeSelect label="Asrama" value={filterAsrama} onChange={e => setFilterAsrama(e.currentTarget.value)}
                  data={ASRAMA_LIST.map(a => ({ value: a, label: a || '— Semua Asrama —' }))}
                  styles={{ label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)' } }} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <NativeSelect label="Sekolah" value={filterSekolah} onChange={e => setFilterSekolah(e.currentTarget.value)}
                  data={[{ value: '', label: '— Semua Sekolah —' }, ...sekolahList.map(s => ({ value: s, label: s }))]}
                  styles={{ label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)' } }} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <TextInput label="Filter Kelas (opsional)" value={filterKelas} onChange={e => setFilterKelas(e.currentTarget.value)} placeholder="mis: 7, 8A"
                  styles={{ label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)' } }} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <Button onClick={handlePreview} loading={loadingPreview} fullWidth color="indigo" fw={700} leftSection={!loadingPreview && <Search className="w-4 h-4" />}>Preview</Button>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Preview hasil */}
          {preview && grouped && (
            <Stack gap="md">
              {/* Ringkasan */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                {Object.entries(grouped).map(([status, list]) => (
                  <Paper key={status} withBorder radius="md" p="sm" ta="center" bg={`${STATUS_MCOLOR[status]}.0`} style={{ borderColor: `var(--mantine-color-${STATUS_MCOLOR[status]}-2)` }}>
                    <Text fz="xl" fw={900} c={`${STATUS_MCOLOR[status]}.7`}>{list.length}</Text>
                    <Text size="xs" fw={700} mt={2} c={`${STATUS_MCOLOR[status]}.7`}>{STATUS_LABEL[status]}</Text>
                  </Paper>
                ))}
              </SimpleGrid>

              {/* Tabel per group */}
              {(['naik', 'lulus_sltp', 'lulus_slta'] as const).map(status => {
                const list = grouped[status]
                if (!list.length) return null
                const listIds = list.map(s => s.id)
                const allSel = listIds.every(id => selectedIds.has(id))
                const color = STATUS_MCOLOR[status]
                return (
                  <Paper key={status} withBorder radius="md" style={{ overflow: 'hidden' }}>
                    <Group justify="space-between" px="md" py="sm" bg={`${color}.1`} style={{ borderBottom: `1px solid var(--mantine-color-${color}-2)` }}>
                      <Group gap="sm">
                        <UnstyledButton onClick={() => toggleAll(listIds)} c={`${color}.8`}>
                          {allSel ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </UnstyledButton>
                        <Text fw={700} size="sm" c={`${color}.8`}>{STATUS_LABEL[status]} ({list.length})</Text>
                      </Group>
                      <Text size="xs" fw={600} c={`${color}.7`}>{listIds.filter(id => selectedIds.has(id)).length} dipilih</Text>
                    </Group>
                    <Box style={{ maxHeight: 256, overflowY: 'auto' }}>
                      {list.map(s => (
                        <Group key={s.id} onClick={() => toggleSelect(s.id)} gap="sm" px="md" py="xs" wrap="nowrap"
                          style={{ cursor: 'pointer', borderTop: '1px solid var(--mantine-color-gray-1)', background: selectedIds.has(s.id) ? 'var(--mantine-color-indigo-0)' : undefined }}>
                          {selectedIds.has(s.id) ? <CheckSquare className="w-4 h-4 shrink-0" color="var(--mantine-color-indigo-6)" /> : <Square className="w-4 h-4 shrink-0" color="var(--mantine-color-gray-3)" />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={600} c="dark.7" truncate>{s.nama_lengkap}</Text>
                            <Text fz={10} c="gray.5">{s.nis} · {s.asrama} · {s.sekolah || '-'}</Text>
                          </div>
                          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                            <Badge variant="light" color="gray" radius="sm" styles={{ label: { fontFamily: 'monospace' } }}>{s.kelas_sekolah}</Badge>
                            <Text c="gray.4">→</Text>
                            <Badge variant="light" radius="sm" color={s.kelas_baru ? 'green' : 'red'} styles={{ label: { fontFamily: 'monospace' } }}>{s.kelas_baru ?? '(kosong)'}</Badge>
                          </Group>
                        </Group>
                      ))}
                    </Box>
                  </Paper>
                )
              })}

              {/* Tidak dikenali (collapsible) */}
              {grouped.tidak_diketahui.length > 0 && (
                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                  <UnstyledButton onClick={() => setShowTidakDikenal(v => !v)} w="100%">
                    <Group justify="space-between" px="md" py="sm" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                      <Text size="sm" fw={700} c="dimmed">Format Tidak Dikenal ({grouped.tidak_diketahui.length}) — tidak akan diproses</Text>
                      {showTidakDikenal ? <ChevronUp className="w-4 h-4" color="var(--mantine-color-gray-5)" /> : <ChevronDown className="w-4 h-4" color="var(--mantine-color-gray-5)" />}
                    </Group>
                  </UnstyledButton>
                  {showTidakDikenal && (
                    <Box style={{ maxHeight: 192, overflowY: 'auto' }}>
                      {grouped.tidak_diketahui.map(s => (
                        <Group key={s.id} gap="sm" px="md" py="xs" wrap="nowrap" style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={600} c="dark.6" truncate>{s.nama_lengkap}</Text>
                            <Text fz={10} c="gray.5">{s.nis} · {s.asrama}</Text>
                          </div>
                          <Badge variant="light" color="gray" radius="sm" styles={{ label: { fontFamily: 'monospace' } }}>&quot;{s.kelas_sekolah}&quot;</Badge>
                        </Group>
                      ))}
                    </Box>
                  )}
                </Paper>
              )}

              {/* Tombol Eksekusi */}
              {selectedIds.size > 0 && (
                <Box style={{ position: 'sticky', bottom: 16, zIndex: 10 }}>
                  <UnstyledButton onClick={handleEksekusi} disabled={eksekusiLoading} w="100%">
                    <Group justify="space-between" px="lg" py="md" bg="indigo.7"
                      style={{ borderRadius: 12, boxShadow: 'var(--mantine-shadow-xl)', opacity: eksekusiLoading ? 0.6 : 1 }}>
                      <div>
                        <Text size="xs" c="indigo.2">Siap dinaikkan</Text>
                        <Text fz="xl" fw={900} c="white">{selectedIds.size} Santri</Text>
                      </div>
                      <Group gap="xs" px="md" py="sm" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                        {eksekusiLoading ? <Loader size="sm" color="white" /> : <ArrowUpCircle className="w-5 h-5" color="#fff" />}
                        <Text fw={900} size="sm" c="white">{eksekusiLoading ? 'Memproses...' : 'EKSEKUSI NAIK KELAS'}</Text>
                      </Group>
                    </Group>
                  </UnstyledButton>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      )}

      {/* TAB 2: MANAJEMEN PEMBEBASAN */}
      {tab === 'pembebasan' && (
        <Stack gap="md">
          {/* Filter */}
          <Paper withBorder radius="md" p="md">
            <Flex gap="md" wrap="wrap" align="flex-end">
              <NativeSelect label="Asrama" value={pbAsrama} onChange={e => setPbAsrama(e.currentTarget.value)}
                data={ASRAMA_LIST.map(a => ({ value: a, label: a || '— Semua Asrama —' }))}
                styles={{ label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)' } }} />
              <TextInput label="Cari Nama / NIS" value={pbSearch} onChange={e => setPbSearch(e.currentTarget.value)} onKeyDown={e => e.key === 'Enter' && loadPembebasan()} placeholder="Nama atau NIS..." w={176}
                styles={{ label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)' } }} />
              <div>
                <Text size="xs" fw={700} c="dimmed" mb={4}>Tahun Pembayaran</Text>
                <Group gap={0} wrap="nowrap" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, overflow: 'hidden' }}>
                  <Button variant="subtle" color="gray" size="compact-md" onClick={() => setPbTahun(t => t - 1)}>−</Button>
                  <Text px="sm" ff="monospace" fw={700} size="sm">{pbTahun}</Text>
                  <Button variant="subtle" color="gray" size="compact-md" onClick={() => setPbTahun(t => t + 1)}>+</Button>
                </Group>
              </div>
              <Checkbox checked={pbHanyaBebas} onChange={e => setPbHanyaBebas(e.currentTarget.checked)} label="Hanya yg bebas SPP" color="indigo" />
              <Button onClick={loadPembebasan} loading={pbLoading} color="indigo" fw={700} leftSection={!pbLoading && <Search className="w-4 h-4" />}>Tampilkan</Button>
            </Flex>
          </Paper>

          {/* Bulk action */}
          {pbSelected.size > 0 && (
            <Group gap="sm" px="md" py="sm" style={{ background: 'var(--mantine-color-indigo-0)', border: '1px solid var(--mantine-color-indigo-2)', borderRadius: 12 }}>
              <Text size="sm" fw={700} c="indigo.7">{pbSelected.size} dipilih</Text>
              <Button size="compact-sm" color="green" fw={700} leftSection={<ShieldCheck className="w-3.5 h-3.5" />} onClick={() => handleToggleBebas([...pbSelected], true)}>Bebaskan SPP</Button>
              <Button size="compact-sm" color="red" fw={700} leftSection={<X className="w-3.5 h-3.5" />} onClick={() => handleToggleBebas([...pbSelected], false)}>Cabut Pembebasan</Button>
              <UnstyledButton onClick={() => setPbSelected(new Set())} ml="auto"><Text size="xs" c="gray.5">Batal pilih</Text></UnstyledButton>
            </Group>
          )}

          {/* Tabel santri */}
          {pbLoading ? (
            <Center py={64}><Loader color="indigo" size="lg" /></Center>
          ) : pbData.length === 0 ? (
            <Stack align="center" py={80} gap="sm">
              <ShieldCheck className="w-12 h-12" color="var(--mantine-color-gray-3)" />
              <Text c="dimmed" fw={600}>Belum ada data</Text>
              <Text size="sm" c="dimmed">Atur filter lalu tekan Tampilkan.</Text>
            </Stack>
          ) : (
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              <Group justify="space-between" px="md" py="xs" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <Group gap="xs">
                  <UnstyledButton onClick={() => {
                    const allIds = pbData.map(s => s.id)
                    const allSel = allIds.every(id => pbSelected.has(id))
                    setPbSelected(allSel ? new Set() : new Set(allIds))
                  }}>
                    {pbData.every(s => pbSelected.has(s.id)) ? <CheckSquare className="w-4 h-4" color="var(--mantine-color-indigo-6)" /> : <Square className="w-4 h-4" color="var(--mantine-color-gray-5)" />}
                  </UnstyledButton>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">{pbData.length} Santri</Text>
                </Group>
                <Text size="xs" c="gray.5">Klik nama untuk kelola pembayaran tahunan</Text>
              </Group>
              <Box style={{ maxHeight: 500, overflowY: 'auto' }}>
                {pbData.map(s => (
                  <Group key={s.id} gap="sm" px="md" py="sm" wrap="nowrap" style={{ borderTop: '1px solid var(--mantine-color-gray-1)', background: pbSelected.has(s.id) ? 'var(--mantine-color-indigo-0)' : undefined }}>
                    <UnstyledButton onClick={() => setPbSelected(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })} style={{ flexShrink: 0 }}>
                      {pbSelected.has(s.id) ? <CheckSquare className="w-4 h-4" color="var(--mantine-color-indigo-6)" /> : <Square className="w-4 h-4" color="var(--mantine-color-gray-3)" />}
                    </UnstyledButton>
                    <Box style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setModalSantri(s)}>
                      <Text size="sm" fw={700} c="dark.7" truncate>{s.nama_lengkap}</Text>
                      <Text fz={10} c="gray.5">{s.nis} · {s.asrama} Kamar {s.kamar}</Text>
                    </Box>
                    <Button size="compact-xs" radius="xl" fw={700} style={{ flexShrink: 0 }}
                      variant="light" color={s.bebas_spp ? 'green' : 'gray'}
                      leftSection={<ShieldCheck className="w-3 h-3" />}
                      onClick={() => handleToggleBebas([s.id], !s.bebas_spp)}>
                      {s.bebas_spp ? 'Bebas SPP' : 'Kena SPP'}
                    </Button>
                    <Group gap={4} justify="flex-end" wrap="wrap" style={{ flexShrink: 0, maxWidth: 140 }}>
                      {s.sudah_bayar.map((jenis: string) => (
                        <Badge key={jenis} size="xs" variant="light" color="blue" radius="sm">{jenis}</Badge>
                      ))}
                    </Group>
                  </Group>
                ))}
              </Box>
            </Paper>
          )}

          {/* Modal pembayaran tahunan */}
          <Modal opened={!!modalSantri} onClose={() => setModalSantri(null)} centered size="md"
            title={modalSantri ? (
              <div>
                <Text fw={700} c="dark.7">{modalSantri.nama_lengkap}</Text>
                <Text size="xs" c="dimmed">{modalSantri.nis} · Tahun {pbTahun}</Text>
              </div>
            ) : null}>
            {modalSantri && (
              <Stack gap="sm">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">Pembayaran Tahunan — Tahun {pbTahun}</Text>
                {JENIS_BIAYA_LIST.map(jenis => {
                  const sudahBebas = modalSantri.sudah_bayar.includes(jenis)
                  return (
                    <Group key={jenis} justify="space-between" p="sm" style={{ borderRadius: 12, border: `1px solid var(--mantine-color-${sudahBebas ? 'blue' : 'gray'}-2)`, background: `var(--mantine-color-${sudahBebas ? 'blue' : 'gray'}-0)` }}>
                      <Group gap="xs">
                        <Banknote className="w-4 h-4" color={sudahBebas ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-5)'} />
                        <Text size="sm" fw={600} c="dark.6">{jenis}</Text>
                        {sudahBebas && <Badge size="xs" color="blue" radius="sm">BEBAS</Badge>}
                      </Group>
                      {sudahBebas ? (
                        <Button size="compact-xs" variant="subtle" color="red" fw={700} leftSection={<X className="w-3 h-3" />} onClick={() => handleHapusBebas(modalSantri.id, jenis)}>Cabut</Button>
                      ) : (
                        <Button size="compact-xs" variant="subtle" color="blue" fw={700} leftSection={<ShieldCheck className="w-3 h-3" />} onClick={() => handleCatatBebas(modalSantri.id, jenis)}>Bebaskan</Button>
                      )}
                    </Group>
                  )
                })}
                <Text fz={10} c="gray.4">Pembebasan dicatat sebagai transaksi Rp 0. Hanya admin yang dapat mengubah ini.</Text>
              </Stack>
            )}
          </Modal>
        </Stack>
      )}
    </div>
  )
}
