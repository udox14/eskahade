'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Filter, Plus, Save, Search, Settings2, Sparkles, Trash2, UsersRound } from 'lucide-react'
import {
  ActionIcon, Badge, Box, Button, Flex, Group, Indicator, Loader, Modal, NativeSelect,
  Paper, SimpleGrid, Stack, Text, TextInput,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { generateGuruKitabDefaults, getGuruKitabSetup, saveGuruKitabAssignments, type GuruKitabSaveRow } from './actions'

type SessionKey = 'shubuh' | 'ashar' | 'maghrib'
type DraftAssignment = {
  draft_id: string
  kelas_id: string
  sesi: SessionKey
  hari_index: number | null
  guru_id: string
  kitab_id: string
  source: 'auto' | 'manual'
  is_active: number
}

const SESSION_META: { key: SessionKey; label: string }[] = [
  { key: 'shubuh', label: 'Shubuh' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Malam' },
]

const HARI_LIST = [
  { index: 1, label: 'Senin' },
  { index: 2, label: 'Selasa' },
  { index: 3, label: 'Rabu' },
  { index: 4, label: 'Kamis' },
  { index: 5, label: 'Jumat' },
  { index: 6, label: 'Sabtu' },
  { index: 0, label: 'Ahad' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultGuruId(kelas: any, sesi: SessionKey) {
  if (sesi === 'shubuh') return kelas.guru_shubuh_id ? String(kelas.guru_shubuh_id) : ''
  if (sesi === 'ashar') return kelas.guru_ashar_id ? String(kelas.guru_ashar_id) : ''
  return kelas.guru_maghrib_id ? String(kelas.guru_maghrib_id) : ''
}

function defaultGuruName(kelas: any, sesi: SessionKey) {
  if (sesi === 'shubuh') return kelas.guru_shubuh_nama || '-'
  if (sesi === 'ashar') return kelas.guru_ashar_nama || '-'
  return kelas.guru_maghrib_nama || '-'
}

function normalizeAssignments(rows: any[]): DraftAssignment[] {
  return rows.map(row => ({
    draft_id: String(row.id || uid()),
    kelas_id: String(row.kelas_id),
    sesi: row.sesi,
    hari_index: row.hari_index == null ? null : Number(row.hari_index),
    guru_id: row.guru_id ? String(row.guru_id) : '',
    kitab_id: row.kitab_id ? String(row.kitab_id) : '',
    source: row.source === 'auto' ? 'auto' : 'manual',
    is_active: row.is_active === 0 ? 0 : 1,
  }))
}

export default function GuruKitabPageContent() {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kitabList, setKitabList] = useState<any[]>([])
  const [gabunganList, setGabunganList] = useState<any[]>([])
  const [assignments, setAssignments] = useState<DraftAssignment[]>([])
  const [tahunAjaranId, setTahunAjaranId] = useState('')
  const [marhalahId, setMarhalahId] = useState('')
  const [search, setSearch] = useState('')
  const [guruFilter, setGuruFilter] = useState('')
  const [overrideModal, setOverrideModal] = useState<{ kelasId: string; sesi: SessionKey } | null>(null)
  const [overrideHariIndex, setOverrideHariIndex] = useState(1)

  const loadData = async (tahunId?: string, mrhId?: string) => {
    setLoading(true)
    const selectedMarhalah = mrhId ?? marhalahId
    const res = await getGuruKitabSetup(Number(tahunId || tahunAjaranId || 0) || null, selectedMarhalah || null)
    setTahunAjaranList(res.tahunAjaranList)
    setMarhalahList(res.marhalahList)
    setGuruList(res.guruList)
    setKelasList(res.kelasList)
    setKitabList(res.kitabList)
    setGabunganList(res.gabunganList)
    setAssignments(normalizeAssignments(res.assignments))
    const selectedTahun = String(tahunId || tahunAjaranId || res.tahunAjaranAktif?.id || res.tahunAjaranList[0]?.id || '')
    setTahunAjaranId(selectedTahun)
    setLoading(false)
  }

  useEffect(() => {
    loadData('', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kitabById = useMemo(() => new Map(kitabList.map(kitab => [String(kitab.id), kitab])), [kitabList])
  const gabunganByKelasSesi = useMemo(() => {
    const map = new Map<string, any>()
    for (const item of gabunganList) map.set(`${item.kelas_id}|${item.sesi}`, item)
    return map
  }, [gabunganList])
  const gabunganMembers = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of gabunganList) {
      const key = `${item.tahun_ajaran_id}|${item.sesi}|${item.group_key}`
      map.set(key, [...(map.get(key) || []), item.kelas_id])
    }
    return map
  }, [gabunganList])

  const filteredKelas = useMemo(() => {
    const q = search.toLowerCase().trim()
    return kelasList.filter(kelas => {
      const matchSearch = !q ||
        String(kelas.nama_kelas || '').toLowerCase().includes(q) ||
        String(kelas.marhalah_nama || '').toLowerCase().includes(q)
      const matchGuru = !guruFilter || assignments.some(row => row.kelas_id === kelas.id && row.guru_id === guruFilter && row.is_active)
      return matchSearch && matchGuru
    })
  }, [kelasList, search, guruFilter, assignments])

  const assignmentsFor = (kelasId: string, sesi: SessionKey, hariIndex: number | null) =>
    assignments.filter(row => row.kelas_id === kelasId && row.sesi === sesi && row.hari_index === hariIndex && row.is_active)

  const kitabOptionsForKelas = (kelas: any) =>
    kitabList.filter(kitab => Number(kitab.marhalah_id) === Number(kelas.marhalah_id))

  const addAssignment = (kelas: any, sesi: SessionKey, hariIndex: number | null = null) => {
    const options = kitabOptionsForKelas(kelas)
    setAssignments(prev => [
      ...prev,
      {
        draft_id: uid(),
        kelas_id: kelas.id,
        sesi,
        hari_index: hariIndex,
        guru_id: defaultGuruId(kelas, sesi),
        kitab_id: options[0] ? String(options[0].id) : '',
        source: 'manual',
        is_active: 1,
      },
    ])
  }

  const updateAssignment = (draftId: string, patch: Partial<DraftAssignment>) => {
    setAssignments(prev => prev.map(row => row.draft_id === draftId ? { ...row, ...patch, source: 'manual' } : row))
  }

  const deleteAssignment = (draftId: string) => {
    setAssignments(prev => prev.filter(row => row.draft_id !== draftId))
  }

  const applyToGabunganMembers = async (kelas: any, sesi: SessionKey) => {
    const gabungan = gabunganByKelasSesi.get(`${kelas.id}|${sesi}`)
    if (!gabungan) return toast.info('Kelas ini belum punya kode gabungan untuk sesi tersebut.')
    const key = `${gabungan.tahun_ajaran_id}|${gabungan.sesi}|${gabungan.group_key}`
    const members = (gabunganMembers.get(key) || []).filter(id => id !== kelas.id)
    if (members.length === 0) return toast.info('Belum ada anggota gabungan lain.')
    if (!await confirm(`Terapkan pembagian ${SESSION_META.find(item => item.key === sesi)?.label} dari ${kelas.nama_kelas} ke ${members.length} kelas gabungan?`)) return

    const sourceRows = assignmentsFor(kelas.id, sesi, null)
    setAssignments(prev => [
      ...prev.filter(row => !(members.includes(row.kelas_id) && row.sesi === sesi && row.hari_index === null)),
      ...members.flatMap(kelasId => sourceRows.map(row => ({
        ...row,
        draft_id: uid(),
        kelas_id: kelasId,
        source: 'manual' as const,
      }))),
    ])
    toast.success('Pembagian diterapkan ke anggota gabungan.')
  }

  const handleGenerate = async () => {
    if (!tahunAjaranId) return toast.warning('Pilih tahun ajaran dulu.')
    if (!await confirm('Generate default akan mengisi data kosong dan memperbarui baris auto. Data manual tetap aman. Lanjut?')) return
    setGenerating(true)
    const res = await generateGuruKitabDefaults(Number(tahunAjaranId))
    setGenerating(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Default dibuat: ${res.inserted} tambah, ${res.updated} update.`)
    await loadData(tahunAjaranId, marhalahId)
  }

  const handleSave = async () => {
    if (!tahunAjaranId) return toast.warning('Pilih tahun ajaran dulu.')
    const visibleIds = new Set(kelasList.map(kelas => kelas.id))
    const rows: GuruKitabSaveRow[] = assignments
      .filter(row => visibleIds.has(row.kelas_id))
      .map(row => ({
        kelas_id: row.kelas_id,
        sesi: row.sesi,
        hari_index: row.hari_index,
        guru_id: Number(row.guru_id || 0) || null,
        kitab_id: Number(row.kitab_id || 0) || null,
        source: row.source,
        is_active: row.is_active,
      }))
    setSaving(true)
    const res = await saveGuruKitabAssignments(Number(tahunAjaranId), rows)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Tersimpan: ${res.saved} baris dari ${res.kelas} kelas.`)
    await loadData(tahunAjaranId, marhalahId)
  }

  const renderAssignmentRows = (kelas: any, sesi: SessionKey, hariIndex: number | null = null) => {
    const rows = assignmentsFor(kelas.id, sesi, hariIndex)
    const options = kitabOptionsForKelas(kelas)
    if (rows.length === 0) {
      return <Text py="sm" size="xs" c="gray.5">Belum ada kitab.</Text>
    }

    return rows.map(row => (
      <Group key={row.draft_id} gap="xs" py="xs" wrap="nowrap" align="flex-start">
        <NativeSelect size="xs" style={{ flex: 1 }} value={row.kitab_id} onChange={e => updateAssignment(row.draft_id, { kitab_id: e.currentTarget.value })}
          data={[{ value: '', label: 'Pilih kitab' }, ...options.map(item => ({ value: String(item.id), label: `${item.mapel_nama} - ${item.nama_kitab}` }))]} />
        <NativeSelect size="xs" style={{ flex: 1 }} value={row.guru_id} onChange={e => updateAssignment(row.draft_id, { guru_id: e.currentTarget.value })}
          data={[{ value: '', label: 'Pilih guru' }, ...guruList.map(guru => ({ value: String(guru.id), label: guru.nama_lengkap }))]} />
        <ActionIcon variant="light" color="pink" size="lg" onClick={() => deleteAssignment(row.draft_id)} aria-label="Hapus baris">
          <Trash2 className="h-4 w-4" />
        </ActionIcon>
      </Group>
    ))
  }

  const activeOverrideClass = overrideModal ? kelasList.find(kelas => kelas.id === overrideModal.kelasId) : null

  return (
    <div className="space-y-5 pb-20">
      <Flex direction={{ base: 'column', sm: 'row' }} gap="md" align={{ sm: 'flex-start' }} justify={{ sm: 'space-between' }}
        pb="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <DashboardPageHeader
          title="Pembagian Kitab Guru"
          description="Atur guru pemegang kitab per tahun ajaran, kelas, sesi, dan override harian."
          className="flex-1"
        />
        <Group gap="xs">
          <Button onClick={handleGenerate} loading={generating} disabled={loading || !tahunAjaranId} color="yellow" fw={700} leftSection={<Sparkles className="h-4 w-4" />}>
            Generate Default
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading || !tahunAjaranId} color="indigo" fw={700} leftSection={<Save className="h-4 w-4" />}>
            Simpan
          </Button>
        </Group>
      </Flex>

      <Paper withBorder radius="lg" p="md" shadow="sm">
        <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
          <NativeSelect leftSection={<CalendarDays className="h-4 w-4" />} value={tahunAjaranId}
            onChange={async e => { setTahunAjaranId(e.currentTarget.value); await loadData(e.currentTarget.value, marhalahId) }}
            data={[{ value: '', label: 'Pilih tahun ajaran' }, ...tahunAjaranList.map(ta => ({ value: String(ta.id), label: ta.nama }))]} />
          <NativeSelect leftSection={<Filter className="h-4 w-4" />} value={marhalahId}
            onChange={async e => { setMarhalahId(e.currentTarget.value); await loadData(tahunAjaranId, e.currentTarget.value) }}
            data={[{ value: '', label: 'Pilih marhalah dulu' }, ...marhalahList.map(m => ({ value: String(m.id), label: m.nama }))]} />
          <TextInput leftSection={<Search className="h-4 w-4" />} disabled={!marhalahId} value={search} onChange={e => setSearch(e.currentTarget.value)} placeholder="Cari kelas..." />
          <NativeSelect leftSection={<UsersRound className="h-4 w-4" />} disabled={!marhalahId} value={guruFilter} onChange={e => setGuruFilter(e.currentTarget.value)}
            data={[{ value: '', label: 'Semua guru' }, ...guruList.map(guru => ({ value: String(guru.id), label: guru.nama_lengkap }))]} />
        </SimpleGrid>
      </Paper>

      {loading ? (
        <Paper withBorder radius="lg" py={80} ta="center"><Loader color="gray" size="lg" mx="auto" /></Paper>
      ) : !marhalahId ? (
        <Paper withBorder style={{ borderStyle: 'dashed' }} radius="lg" py={80} ta="center">
          <Text fw={700} c="dark.6">Pilih marhalah dulu</Text>
          <Text size="sm" c="dimmed" mt={4}>Data kelas dan kitab baru dimuat setelah filter marhalah dipilih.</Text>
        </Paper>
      ) : filteredKelas.length === 0 ? (
        <Paper withBorder radius="lg" py={80} ta="center"><Text c="dimmed">Tidak ada kelas untuk marhalah/filter ini.</Text></Paper>
      ) : (
        <Stack gap="md">
          {filteredKelas.map(kelas => (
            <Paper key={kelas.id} component="section" withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
              <Flex direction={{ base: 'column', sm: 'row' }} gap="sm" align={{ sm: 'flex-start' }} justify={{ sm: 'space-between' }}
                px="md" py="sm" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                <div style={{ minWidth: 0 }}>
                  <Text fz="md" fw={900} c="dark.8">{kelas.nama_kelas}</Text>
                  <Text size="xs" fw={600} c="dimmed">{kelas.marhalah_nama}</Text>
                </div>
                <Group gap="xs" justify="flex-end">
                  {SESSION_META.map(session => (
                    <Badge key={session.key} variant="outline" color="gray" radius="xl" tt="none" maw="100%">
                      {session.label}: {defaultGuruName(kelas, session.key)}
                    </Badge>
                  ))}
                </Group>
              </Flex>

              <SimpleGrid cols={{ base: 1, lg: 3 }} spacing={0}>
                {SESSION_META.map((session, si) => {
                  const gabungan = gabunganByKelasSesi.get(`${kelas.id}|${session.key}`)
                  const overrideCount = HARI_LIST.reduce((total, day) => total + assignmentsFor(kelas.id, session.key, day.index).length, 0)
                  return (
                    <Box key={session.key} p="md" style={{ borderTop: si > 0 ? '1px solid var(--mantine-color-gray-1)' : undefined }}>
                      <Group justify="space-between" align="flex-start" mb="sm" gap="sm">
                        <div>
                          <Group gap="xs"><BookOpen className="h-4 w-4" color="var(--mantine-color-indigo-6)" /><Text fw={700} c="dark.7">{session.label}</Text></Group>
                          {gabungan ? (
                            <Text size="11px" fw={600} c="indigo.6" mt={4}>Gabungan: {gabungan.group_key}{gabungan.tempat ? ` - ${gabungan.tempat}` : ''}</Text>
                          ) : (
                            <Text size="11px" c="gray.5" mt={4}>Tidak digabung</Text>
                          )}
                        </div>
                        <Group gap={4}>
                          {gabungan ? (
                            <ActionIcon variant="light" color="indigo" onClick={() => applyToGabunganMembers(kelas, session.key)} aria-label="Terapkan ke anggota gabungan">
                              <UsersRound className="h-4 w-4" />
                            </ActionIcon>
                          ) : null}
                          <ActionIcon variant="light" color="teal" onClick={() => addAssignment(kelas, session.key)} aria-label="Tambah kitab">
                            <Plus className="h-4 w-4" />
                          </ActionIcon>
                          <Indicator label={overrideCount} size={16} color="yellow" disabled={overrideCount === 0}>
                            <ActionIcon variant="default" onClick={() => { setOverrideHariIndex(1); setOverrideModal({ kelasId: kelas.id, sesi: session.key }) }} aria-label="Override harian">
                              <Settings2 className="h-4 w-4" />
                            </ActionIcon>
                          </Indicator>
                        </Group>
                      </Group>
                      <Stack gap={0}>
                        {renderAssignmentRows(kelas, session.key)}
                      </Stack>
                    </Box>
                  )
                })}
              </SimpleGrid>
            </Paper>
          ))}
        </Stack>
      )}

      <Modal
        opened={!!(overrideModal && activeOverrideClass)}
        onClose={() => setOverrideModal(null)}
        size={768}
        centered
        title={overrideModal && activeOverrideClass ? (
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="indigo.6">{activeOverrideClass.nama_kelas}</Text>
            <Text fz="lg" fw={900} c="dark.8">Override Harian {SESSION_META.find(item => item.key === overrideModal.sesi)?.label}</Text>
          </div>
        ) : null}
      >
        {overrideModal && activeOverrideClass ? (
          <>
            <Text size="sm" c="dimmed" mb="sm">Pilih hari di bawah. Kosong berarti memakai pembagian default sesi.</Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
              {HARI_LIST.map(day => {
                const count = assignmentsFor(activeOverrideClass.id, overrideModal.sesi, day.index).length
                const selected = overrideHariIndex === day.index
                return (
                  <Button key={day.index} size="xs" fw={700}
                    variant={selected ? 'light' : count ? 'light' : 'default'}
                    color={selected ? 'indigo' : count ? 'yellow' : 'gray'}
                    onClick={() => setOverrideHariIndex(day.index)}>
                    {day.label} {count ? `(${count})` : ''}
                  </Button>
                )
              })}
            </SimpleGrid>
            <Stack gap={0}>
              {renderAssignmentRows(activeOverrideClass, overrideModal.sesi, overrideHariIndex)}
            </Stack>
            <Button mt="md" variant="light" color="teal" fw={700} leftSection={<Plus className="h-4 w-4" />}
              onClick={() => addAssignment(activeOverrideClass, overrideModal.sesi, overrideHariIndex)}>
              Tambah Override
            </Button>
            <Group justify="flex-end" gap="xs" mt="lg" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Button variant="default" onClick={() => setOverrideModal(null)}>Tutup</Button>
              <Button color="indigo" onClick={() => setOverrideModal(null)}>Selesai</Button>
            </Group>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
