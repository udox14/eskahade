import { execute } from '@/lib/db'

const PENGURUS_COLUMNS = [
  'km_id TEXT REFERENCES santri(id)',
  'wakil_km_id TEXT REFERENCES santri(id)',
  'sekretaris_id TEXT REFERENCES santri(id)',
  'wakil_sekretaris_id TEXT REFERENCES santri(id)',
]

export async function ensureKelasPengurusColumns() {
  for (const column of PENGURUS_COLUMNS) {
    try {
      await execute(`ALTER TABLE kelas ADD COLUMN ${column}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes('duplicate column name')) {
        throw error
      }
    }
  }
}
