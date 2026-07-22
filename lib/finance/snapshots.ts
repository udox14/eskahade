import { financeQuery, getFinanceDB, query, queryOne } from '@/lib/db'

export type FinanceStudentSnapshot = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  foto_url: string | null
  status_global: string
}

export async function syncFinanceStudentSnapshot(santriId: string): Promise<FinanceStudentSnapshot | null> {
  const student = await queryOne<FinanceStudentSnapshot>(
    `SELECT id,nis,nama_lengkap,asrama,kamar,foto_url,status_global FROM santri WHERE id=?`,
    [santriId],
  )
  if (!student) return null
  const db = await getFinanceDB()
  await db.prepare(`INSERT INTO finance_student_snapshots(santri_id,nis,full_name,asrama,kamar,photo_url,status_global,synced_at)
    VALUES(?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(santri_id) DO UPDATE SET nis=excluded.nis,full_name=excluded.full_name,asrama=excluded.asrama,kamar=excluded.kamar,
      photo_url=excluded.photo_url,status_global=excluded.status_global,synced_at=datetime('now')`)
    .bind(student.id,student.nis,student.nama_lengkap,student.asrama,student.kamar,student.foto_url,student.status_global).run()
  return student
}

export async function syncFinanceStudentsByIds(santriIds: string[]): Promise<void> {
  const ids = [...new Set(santriIds.filter(Boolean))]
  if (!ids.length) return
  for (let offset = 0; offset < ids.length; offset += 80) {
    const chunk = ids.slice(offset, offset + 80)
    const students = await query<FinanceStudentSnapshot>(
      `SELECT id,nis,nama_lengkap,asrama,kamar,foto_url,status_global FROM santri WHERE id IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    )
    const db = await getFinanceDB()
    await db.batch(students.map(student => db.prepare(`INSERT INTO finance_student_snapshots(santri_id,nis,full_name,asrama,kamar,photo_url,status_global,synced_at)
      VALUES(?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET nis=excluded.nis,full_name=excluded.full_name,asrama=excluded.asrama,kamar=excluded.kamar,
        photo_url=excluded.photo_url,status_global=excluded.status_global,synced_at=datetime('now')`)
      .bind(student.id,student.nis,student.nama_lengkap,student.asrama,student.kamar,student.foto_url,student.status_global)))
  }
}

export async function syncFinanceTeacherSnapshots(teacherIds: string[]): Promise<void> {
  const ids = [...new Set(teacherIds.filter(Boolean))]
  if (!ids.length) return
  for (let offset = 0; offset < ids.length; offset += 80) {
    const chunk = ids.slice(offset, offset + 80)
    const teachers = await query<{ id: number; nama_lengkap: string }>(
      `SELECT id,nama_lengkap FROM data_guru WHERE CAST(id AS TEXT) IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    )
    const db = await getFinanceDB()
    await db.batch(teachers.map(teacher => db.prepare(`INSERT INTO finance_teacher_snapshots(teacher_id,full_name,synced_at)
      VALUES(?,?,datetime('now')) ON CONFLICT(teacher_id) DO UPDATE SET full_name=excluded.full_name,synced_at=datetime('now')`)
      .bind(String(teacher.id),teacher.nama_lengkap)))
  }
}

export async function financeStudentIdsForGuardian(guardianId: string): Promise<string[]> {
  const rows = await financeQuery<{ santri_id: string }>(
    `SELECT santri_id FROM finance_guardian_students WHERE guardian_id=? ORDER BY linked_at`,
    [guardianId],
  )
  return rows.map(row => row.santri_id)
}
