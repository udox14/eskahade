'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getDaftarTarif, getTarifByTahun, simpanTarif } from './actions'
import { Save, History, Edit } from 'lucide-react'
import {
  Button, Center, Grid, Group, Loader, NumberInput, Paper, Table, Text,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function TarifPage() {
  // State Form
  const [tahunInput, setTahunInput] = useState(new Date().getFullYear())
  const [nominal, setNominal] = useState({
    BANGUNAN: 0,
    KESEHATAN: 0,
    EHB: 0,
    EKSKUL: 0,
  })

  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // State List
  const [listTarif, setListTarif] = useState<any[]>([])

  // Init Load List
  useEffect(() => {
    refreshList()
  }, [])

  // Auto Load saat Tahun diubah (Cek apakah sudah ada tarif?)
  useEffect(() => {
    async function checkExisting() {
      setLoading(true)
      const res = await getTarifByTahun(tahunInput)
      setNominal(res)
      setLoading(false)
    }
    checkExisting()
  }, [tahunInput])

  const refreshList = async () => {
    const data = await getDaftarTarif()
    setListTarif(data)
  }

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const toastId = toast.loading('Menyimpan tarif...')

    const res = await simpanTarif(tahunInput, nominal)

    setIsSaving(false)
    toast.dismiss(toastId)

    if ('error' in res) {
      toast.error('Gagal', { description: (res as any).error })
    } else {
      toast.success('Tarif Berhasil Disimpan', { description: `Angkatan ${tahunInput} telah diperbarui.` })
      refreshList()
    }
  }

  // Format Rupiah Helper
  const rp = (val: number) => 'Rp ' + (val || 0).toLocaleString('id-ID')

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER */}
      <DashboardPageHeader
        title="Pengaturan Tarif Angkatan"
        description="Tentukan besaran biaya masuk dan tahunan berdasarkan tahun masuk santri."
      />

      <Grid gutter="xl">
        {/* KOLOM KIRI: FORM INPUT */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="md" p="lg" shadow="sm" style={{ position: 'sticky', top: 96 }}>
            <Group gap="xs" pb="md" mb="lg" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Edit className="w-5 h-5" color="var(--mantine-color-teal-6)" />
              <Text fw={700} c="dark.7">Edit / Baru</Text>
            </Group>

            <form onSubmit={handleSimpan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Tahun Selector */}
                <div>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>Tahun Angkatan (Masuk)</Text>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Button variant="light" color="gray" size="lg" px={0} w={48} h={48}
                      onClick={() => setTahunInput(t => t - 1)} aria-label="Kurangi tahun">−</Button>
                    <NumberInput
                      hideControls
                      value={tahunInput}
                      onChange={(v) => setTahunInput(Number(v) || 0)}
                      styles={{ input: { textAlign: 'center', fontWeight: 700, fontSize: 18, height: 48 } }}
                      style={{ flex: 1 }}
                    />
                    <Button variant="light" color="gray" size="lg" px={0} w={48} h={48}
                      onClick={() => setTahunInput(t => t + 1)} aria-label="Tambah tahun">+</Button>
                  </Group>
                </div>

                <hr style={{ border: 'none', borderTop: '1px dashed var(--mantine-color-gray-4)', margin: 0 }} />

                {/* Input Biaya */}
                {loading ? (
                  <Center py={40}><Loader color="gray" /></Center>
                ) : (
                  <>
                    <InputDuit label="Uang Bangunan (Sekali)" value={nominal.BANGUNAN} onChange={v => setNominal({ ...nominal, BANGUNAN: v })} />
                    <InputDuit label="Infaq Kesehatan (Tahunan)" value={nominal.KESEHATAN} onChange={v => setNominal({ ...nominal, KESEHATAN: v })} />
                    <InputDuit label="Uang EHB (Tahunan)" value={nominal.EHB} onChange={v => setNominal({ ...nominal, EHB: v })} />
                    <InputDuit label="Ekstrakurikuler (Tahunan)" value={nominal.EKSKUL} onChange={v => setNominal({ ...nominal, EKSKUL: v })} />
                  </>
                )}

                <Button
                  type="submit"
                  fullWidth
                  color="teal"
                  size="md"
                  fw={700}
                  loading={isSaving}
                  disabled={loading}
                  leftSection={<Save className="w-5 h-5" />}
                >
                  SIMPAN TARIF
                </Button>
              </div>
            </form>
          </Paper>
        </Grid.Col>

        {/* KOLOM KANAN: TABEL RIWAYAT */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" p="md" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Group gap="xs">
                <History className="w-5 h-5" />
                <Text fw={700} c="dark.6">Daftar Tarif Tersimpan</Text>
              </Group>
            </Group>

            {listTarif.length === 0 ? (
              <Center p={40}><Text c="dimmed" fs="italic">Belum ada data tarif yang diatur.</Text></Center>
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="md" horizontalSpacing="lg" fz="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Angkatan</Table.Th>
                      <Table.Th ta="right">Bangunan</Table.Th>
                      <Table.Th ta="right">Kesehatan</Table.Th>
                      <Table.Th ta="right">EHB</Table.Th>
                      <Table.Th ta="right">Ekskul</Table.Th>
                      <Table.Th ta="center">Aksi</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {listTarif.map((item: any) => (
                      <Table.Tr key={item.tahun} bg={item.tahun === tahunInput ? 'teal.0' : undefined}>
                        <Table.Td fw={700} fz="lg" c="teal.8">{item.tahun}</Table.Td>
                        <Table.Td ta="right" ff="monospace">{rp(item.BANGUNAN)}</Table.Td>
                        <Table.Td ta="right" ff="monospace">{rp(item.KESEHATAN)}</Table.Td>
                        <Table.Td ta="right" ff="monospace">{rp(item.EHB)}</Table.Td>
                        <Table.Td ta="right" ff="monospace">{rp(item.EKSKUL)}</Table.Td>
                        <Table.Td ta="center">
                          <Button size="compact-xs" radius="xl" variant="outline" color="teal"
                            onClick={() => setTahunInput(item.tahun)}>
                            Edit
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  )
}

// Sub Component: Input Duit
function InputDuit({ label, value, onChange }: { label: string; value: number; onChange: (val: number) => void }) {
  return (
    <NumberInput
      label={label}
      prefix="Rp "
      thousandSeparator="."
      decimalScale={0}
      allowNegative={false}
      hideControls
      value={value}
      onChange={(v) => onChange(typeof v === 'number' ? v : Number(v) || 0)}
      onFocus={(e) => e.currentTarget.select()}
      styles={{
        label: { fontSize: 12, fontWeight: 700, color: 'var(--mantine-color-dimmed)', textTransform: 'uppercase' },
        input: { fontFamily: 'monospace', textAlign: 'right' },
      }}
    />
  )
}
