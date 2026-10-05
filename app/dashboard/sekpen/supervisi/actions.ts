'use server';
import { batch, execute, query, queryOne } from '@/lib/db';
import { requireSupervisi, teachersForYear, validDate, boundedText, HREF } from '@/lib/supervisi/server';
import { completedCount, normalizeAnswers, summarize, type Answers } from '@/lib/supervisi/instrument';
import type { Activity, Coverage, Interview, Identity, Teacher } from '@/lib/supervisi/types';
import { getSession, isAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { actorFromSession, logActivity } from '@/lib/activity-log';
type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
    try {
        return { ok: true, data: await fn() };
    }
    catch (e) {
        console.error('[supervisi]', e);
        const message = e instanceof Error ? e.message : '';
        return { ok: false, error: !message || /D1_ERROR|SQLITE|constraint|no such|syntax error|fetch failed/i.test(message)
                ? 'Data belum dapat disimpan. Muat ulang untuk memeriksa status atau hubungi admin.'
                : message };
    }
}
type InterviewRow = {
    id: string;
    kegiatan_id: string;
    guru_id: number;
    owner_id: string;
    identity_json: string;
    answers_json: string;
    tanggal: string;
    status: 'draft' | 'selesai';
    revision: number;
    activity_status: string;
};
async function rowWithAccess(id: string) {
    const access = await requireSupervisi();
    const row = await queryOne<InterviewRow>(`SELECT w.*,k.status AS activity_status FROM supervisi_wawancara w JOIN supervisi_kegiatan k ON k.id=w.kegiatan_id WHERE w.id=?`, [id]);
    if (!row || (!access.all && row.owner_id !== access.session.id))
        throw new Error('Hasil wawancara tidak dapat diakses.');
    return { row, access };
}
export async function getSupervisiHome() {
    const access = await requireSupervisi();
    const [activities, years] = await Promise.all([
        query<Activity>(`SELECT k.*,ta.nama AS tahun_nama FROM supervisi_kegiatan k JOIN tahun_ajaran ta ON ta.id=k.tahun_ajaran_id ORDER BY k.created_at DESC,k.id`),
        query<{
            id: number;
            nama: string;
            is_active: number;
        }>('SELECT id,nama,is_active FROM tahun_ajaran ORDER BY is_active DESC,id DESC'),
    ]);
    return { activities, years, admin: access.admin, all: access.all };
}
export async function getCoverage(activityId: string, search = '', status = 'all', kelas = '', page = 1) {
    const access = await requireSupervisi();
    const offset = (Math.max(1, Math.floor(page)) - 1) * 20;
    const params: unknown[] = [activityId, `%${search.slice(0, 100)}%`];
    let where = `t.kegiatan_id=? AND t.guru_nama LIKE ?`;
    if (['belum', 'draft', 'selesai'].includes(status)) {
        where += ` AND COALESCE(w.status,'belum')=?`;
        params.push(status);
    }
    if (kelas) {
        where += ` AND EXISTS(SELECT 1 FROM json_each(t.kelas_json) WHERE value=?)`;
        params.push(kelas);
    }
    type Row = {
        guru_id: number;
        guru_nama: string;
        kelas_json: string;
        status: Coverage['status'];
        completed_count: number;
        interview_id: string | null;
        owner_id: string | null;
    };
    const [rows, count, totals, allClasses] = await Promise.all([
        query<Row>(`SELECT t.guru_id,t.guru_nama,t.kelas_json,COALESCE(w.status,'belum') AS status,COALESCE(w.completed_count,0) AS completed_count,w.id AS interview_id,w.owner_id FROM supervisi_target t LEFT JOIN supervisi_wawancara w ON w.kegiatan_id=t.kegiatan_id AND w.guru_id=t.guru_id WHERE ${where} ORDER BY t.guru_nama LIMIT 20 OFFSET ?`, [...params, offset]),
        queryOne<{
            n: number;
        }>(`SELECT COUNT(*) n FROM supervisi_target t LEFT JOIN supervisi_wawancara w ON w.kegiatan_id=t.kegiatan_id AND w.guru_id=t.guru_id WHERE ${where}`, params),
        query<{
            status: string;
            n: number;
        }>(`SELECT COALESCE(w.status,'belum') AS status,COUNT(*) n FROM supervisi_target t LEFT JOIN supervisi_wawancara w ON w.kegiatan_id=t.kegiatan_id AND w.guru_id=t.guru_id WHERE t.kegiatan_id=? GROUP BY COALESCE(w.status,'belum')`, [activityId]),
        query<{
            nama: string;
        }>(`SELECT DISTINCT j.value AS nama FROM supervisi_target t,json_each(t.kelas_json) j WHERE t.kegiatan_id=? ORDER BY j.value`, [activityId]),
    ]);
    return { rows: rows.map(({ owner_id, kelas_json, ...r }) => ({ ...r, kelas: JSON.parse(kelas_json) as string[], accessible: !r.interview_id || access.all || owner_id === access.session.id, interview_id: access.all || owner_id === access.session.id ? r.interview_id : null })), total: count?.n ?? 0, totals, classes: allClasses.map(r => r.nama) };
}
export async function getSupervisiAnalytics(activityId: string) {
    const access = await requireSupervisi();
    const rows = await query<{
        answers_json: string;
    }>(`SELECT answers_json FROM supervisi_wawancara WHERE kegiatan_id=? AND status='selesai'${access.all ? '' : ' AND owner_id=?'}`, [activityId, ...(access.all ? [] : [access.session.id])]);
    return { count: rows.length, all: access.all, sections: summarize(rows.map(r => JSON.parse(r.answers_json) as Answers)) };
}
export async function getInterview(id: string): Promise<Interview> {
    const { row, access } = await rowWithAccess(id);
    return { id: row.id, kegiatan_id: row.kegiatan_id, guru_id: row.guru_id, owner_id: row.owner_id, status: row.status, tanggal: row.tanggal, revision: row.revision, answers: JSON.parse(row.answers_json), identity: JSON.parse(row.identity_json), editable: row.status === 'draft' && row.activity_status === 'terbuka', admin: access.admin, activityOpen: row.activity_status === 'terbuka' };
}
export async function getInterviewHistory(id: string) {
    await rowWithAccess(id);
    return query<{
        id: number;
        action: string;
        reason: string | null;
        revision: number;
        created_at: string;
        actor_name: string;
    }>(`SELECT h.id,h.action,h.reason,h.revision,h.created_at,u.full_name AS actor_name FROM supervisi_history h JOIN users u ON u.id=h.actor_id WHERE h.wawancara_id=? ORDER BY h.id DESC LIMIT 100`, [id]);
}
export async function getActivityTeachers(activityId: string): Promise<Teacher[]> {
    await requireSupervisi();
    const activity = await queryOne<Activity>('SELECT * FROM supervisi_kegiatan WHERE id=?', [activityId]);
    if (!activity)
        throw new Error('Kegiatan tidak ditemukan.');
    const teachers = await teachersForYear(activity.tahun_ajaran_id);
    if (activity.status === 'persiapan') {
        await requireSupervisi(true);
        return teachers;
    }
    const targets = await query<{
        guru_id: number;
    }>('SELECT guru_id FROM supervisi_target WHERE kegiatan_id=?', [activityId]);
    return teachers.filter(t => targets.some(x => x.guru_id === t.id));
}
export async function createActivity(nama: string, year: number, guruIds: number[]) {
    return attempt(async () => {
        const { session } = await requireSupervisi(true);
        const teachers = await teachersForYear(year);
        const yearRow = await queryOne('SELECT id FROM tahun_ajaran WHERE id=?', [year]);
        if (!yearRow)
            throw new Error('Tahun ajaran tidak valid.');
        const targets = teachers.filter(t => guruIds.includes(t.id));
        if (!targets.length || new Set(guruIds).size !== targets.length)
            throw new Error('Pilih target guru yang valid.');
        const id = crypto.randomUUID();
        await batch([{ sql: 'INSERT INTO supervisi_kegiatan(id,nama,tahun_ajaran_id,actor_id) VALUES(?,?,?,?)', params: [id, boundedText(nama), year, session.id] }, ...targets.map(t => ({ sql: 'INSERT INTO supervisi_target(kegiatan_id,guru_id,guru_nama,kelas_json) VALUES(?,?,?,?)', params: [id, t.id, t.nama, JSON.stringify(t.kelas)] }))]);
        return id;
    });
}
export async function getTeacherCandidates(year: number) { await requireSupervisi(true); return teachersForYear(year); }
export async function getActivityTargetIds(id: string) {
    await requireSupervisi(true);
    return (await query<{
        guru_id: number;
    }>('SELECT guru_id FROM supervisi_target WHERE kegiatan_id=?', [id])).map(t => t.guru_id);
}
export async function updateActivityTargets(id: string, guruIds: number[]) {
    return attempt(async () => {
        const { session } = await requireSupervisi(true);
        const activity = await queryOne<Activity>('SELECT * FROM supervisi_kegiatan WHERE id=?', [id]);
        if (!activity || activity.status !== 'persiapan')
            throw new Error('Target hanya dapat diubah saat persiapan.');
        const teachers = await teachersForYear(activity.tahun_ajaran_id), selected = teachers.filter(t => guruIds.includes(t.id));
        if (!selected.length || selected.length !== new Set(guruIds).size)
            throw new Error('Pilih target guru yang valid.');
        await batch([{ sql: 'DELETE FROM supervisi_target WHERE kegiatan_id=?', params: [id] }, ...selected.map(t => ({ sql: 'INSERT INTO supervisi_target(kegiatan_id,guru_id,guru_nama,kelas_json) VALUES(?,?,?,?)', params: [id, t.id, t.nama, JSON.stringify(t.kelas)] })), { sql: "UPDATE supervisi_kegiatan SET revision=revision+1,actor_id=?,reason='Perubahan target',updated_at=datetime('now') WHERE id=? AND status='persiapan'", params: [session.id, id] }]);
        return true;
    });
}
export async function changeActivityStatus(id: string, status: 'terbuka' | 'ditutup', revision: number, reason = '') {
    return attempt(async () => {
        const { session } = await requireSupervisi(true);
        const activity = await queryOne<Activity>('SELECT * FROM supervisi_kegiatan WHERE id=?', [id]);
        if (!activity || activity.revision !== revision)
            throw new Error('Kegiatan berubah. Muat ulang terlebih dahulu.');
        if (!['terbuka', 'ditutup'].includes(status) || activity.status === status || (status === 'ditutup' && activity.status !== 'terbuka'))
            throw new Error('Perubahan status tidak valid.');
        const note = activity.status === 'ditutup' ? boundedText(reason, 1000) : reason.trim();
        const db = (await import('@/lib/db')).getDB;
        const connection = await db();
        const result = await connection.prepare(`UPDATE supervisi_kegiatan SET status=?,revision=revision+1,actor_id=?,reason=?,updated_at=datetime('now') WHERE id=? AND revision=?`).bind(status, session.id, note, id, revision).run();
        if (!result.meta.changes)
            throw new Error('Kegiatan berubah. Muat ulang terlebih dahulu.');
        return true;
    });
}
async function identityFor(activityId: string, guruId: number, key: string, pewawancara: string): Promise<Identity> {
    const activity = await queryOne<Activity>(`SELECT k.*,ta.nama AS tahun_nama FROM supervisi_kegiatan k JOIN tahun_ajaran ta ON ta.id=k.tahun_ajaran_id WHERE k.id=? AND k.status='terbuka'`, [activityId]);
    if (!activity)
        throw new Error('Kegiatan belum terbuka.');
    const target = await queryOne<{
        guru_nama: string;
    }>('SELECT guru_nama FROM supervisi_target WHERE kegiatan_id=? AND guru_id=?', [activityId, guruId]);
    if (!target)
        throw new Error('Guru bukan target kegiatan.');
    const teachers = await teachersForYear(activity.tahun_ajaran_id);
    const context = teachers.find(t => t.id === guruId)?.contexts.find(c => c.key === key);
    if (!context)
        throw new Error('Kelas, waktu, atau pembagian kitab belum lengkap. Perbaiki master penugasan terlebih dahulu.');
    return { ...context, guru_nama: target.guru_nama, pewawancara, kegiatan_nama: activity.nama, tahun_nama: activity.tahun_nama };
}
export async function updateInterviewIdentity(id: string, revision: number, guruId: number, key: string) {
    return attempt(async () => {
        const { row, access } = await rowWithAccess(id);
        if (row.status !== 'draft' || Object.keys(JSON.parse(row.answers_json)).length)
            throw new Error('Pilihan guru dan kelas terkunci setelah pengisian dimulai.');
        const occupied = await queryOne<{
            id: string;
        }>('SELECT id FROM supervisi_wawancara WHERE kegiatan_id=? AND guru_id=? AND id<>?', [row.kegiatan_id, guruId, id]);
        if (occupied)
            throw new Error('Guru tujuan sudah memiliki wawancara. Pilih guru yang belum dimulai.');
        const identity = await identityFor(row.kegiatan_id, guruId, key, (JSON.parse(row.identity_json) as Identity).pewawancara);
        const connection = await (await import('@/lib/db')).getDB();
        const result = await connection.prepare(`UPDATE supervisi_wawancara SET guru_id=?,identity_json=?,revision=revision+1,actor_id=?,operation_id=?,action='identity',reason='Koreksi identitas sebelum pengisian',updated_at=datetime('now') WHERE id=? AND revision=?`).bind(guruId, JSON.stringify(identity), access.session.id, crypto.randomUUID(), id, revision).run();
        if (!result.meta.changes)
            throw new Error('CONFLICT: Draft sudah berubah. Muat versi terbaru terlebih dahulu.');
        return true;
    });
}
export async function startInterview(activityId: string, guruId: number, key: string, tanggal: string) {
    return attempt(async () => {
        const access = await requireSupervisi();
        const existing = await queryOne<{
            id: string;
            owner_id: string;
        }>('SELECT id,owner_id FROM supervisi_wawancara WHERE kegiatan_id=? AND guru_id=?', [activityId, guruId]);
        if (existing) {
            if (!access.all && existing.owner_id !== access.session.id)
                throw new Error('Guru ini sudah ditangani petugas lain.');
            return existing.id;
        }
        const identity = await identityFor(activityId, guruId, key, access.session.full_name);
        const id = crypto.randomUUID();
        await execute(`INSERT OR IGNORE INTO supervisi_wawancara(id,kegiatan_id,guru_id,owner_id,identity_json,tanggal,actor_id,operation_id) VALUES(?,?,?,?,?,?,?,?)`, [id, activityId, guruId, access.session.id, JSON.stringify(identity), validDate(tanggal), access.session.id, crypto.randomUUID()]);
        const actual = await queryOne<{
            id: string;
            owner_id: string;
        }>('SELECT id,owner_id FROM supervisi_wawancara WHERE kegiatan_id=? AND guru_id=?', [activityId, guruId]);
        if (!actual || (!access.all && actual.owner_id !== access.session.id))
            throw new Error('Guru ini sudah ditangani petugas lain.');
        return actual.id;
    });
}
export async function saveInterview(input: {
    id: string;
    revision: number;
    operationId: string;
    patch: Answers;
    tanggal?: string;
    action?: 'save' | 'submit' | 'reopen';
    reason?: string;
}) {
    return attempt(async () => {
        const { row, access } = await rowWithAccess(input.id);
        boundedText(input.operationId, 100);
        const prior = await queryOne<{
            revision: number;
        }>('SELECT revision FROM supervisi_history WHERE wawancara_id=? AND operation_id=?', [input.id, input.operationId]);
        if (prior)
            return { revision: prior.revision, replayed: true };
        const action = input.action ?? 'save';
        if (!['save', 'submit', 'reopen'].includes(action))
            throw new Error('Tindakan tidak valid.');
        if (row.activity_status !== 'terbuka')
            throw new Error('Kegiatan ditutup. Perubahan belum tersimpan.');
        if (row.revision !== input.revision)
            throw new Error('CONFLICT: Hasil telah diubah petugas lain. Muat versi terbaru sebelum menyimpan ulang perubahan Anda.');
        if (action === 'reopen' && !access.admin)
            throw new Error('Hanya admin yang dapat membuka kembali hasil.');
        if ((row.status === 'selesai' && action !== 'reopen') || (row.status === 'draft' && action === 'reopen'))
            throw new Error('Status wawancara tidak sesuai.');
        const patch = normalizeAnswers(input.patch);
        if (action === 'reopen' && (Object.keys(patch).length || input.tanggal !== undefined))
            throw new Error('Buka kembali tidak boleh mengubah jawaban.');
        const answers: Answers = { ...JSON.parse(row.answers_json), ...patch }, count = completedCount(answers);
        if (action === 'submit' && count !== 53)
            throw new Error('Semua 53 item wajib dijawab. Tidak diketahui harus disertai catatan.');
        const reason = action === 'reopen' ? boundedText(input.reason ?? '', 1000) : null;
        const tanggal = input.tanggal !== undefined ? validDate(input.tanggal) : row.tanggal;
        // Trigger appends before/after history in the same statement. CAS is checked at write time.
        const connection = await (await import('@/lib/db')).getDB();
        const result = await connection.prepare(`UPDATE supervisi_wawancara SET answers_json=?,completed_count=?,tanggal=?,status=?,revision=revision+1,actor_id=?,operation_id=?,action=?,reason=?,updated_at=datetime('now') WHERE id=? AND revision=?`).bind(JSON.stringify(answers), count, tanggal, action === 'submit' ? 'selesai' : 'draft', access.session.id, input.operationId, action, reason, input.id, input.revision).run();
        if (!result.meta.changes) {
            const replay = await queryOne<{
                revision: number;
            }>('SELECT revision FROM supervisi_history WHERE wawancara_id=? AND operation_id=?', [input.id, input.operationId]);
            if (replay)
                return { revision: replay.revision, replayed: true };
            throw new Error('CONFLICT: Hasil telah diubah petugas lain. Muat versi terbaru sebelum menyimpan ulang perubahan Anda.');
        }
        return { revision: row.revision + 1, replayed: false };
    });
}
export async function getSupervisiUserPermission(userId: string) {
    const session = await getSession();
    if (!isAdmin(session))
        throw new Error('Akses ditolak.');
    const row = await queryOne<{
        can_manage_all: number;
    }>('SELECT can_manage_all FROM supervisi_user_permission WHERE user_id=?', [userId]);
    return Boolean(row?.can_manage_all);
}
export async function setSupervisiUserPermission(userId: string, all: boolean) {
    return attempt(async () => {
        const session = await getSession();
        if (!session || !isAdmin(session))
            throw new Error('Akses ditolak.');
        if (typeof all !== 'boolean' || !await queryOne('SELECT id FROM users WHERE id=?', [userId]))
            throw new Error('User tidak valid.');
        await execute('INSERT INTO supervisi_user_permission(user_id,can_manage_all) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET can_manage_all=excluded.can_manage_all', [userId, all ? 1 : 0]);
        await logActivity({ actor: actorFromSession(session), module: 'supervisi', action: 'access_change', fiturHref: HREF, logKind: 'update', entityType: 'user', entityId: userId, summary: all ? 'Memberikan izin kelola semua Supervisi' : 'Mencabut izin kelola semua Supervisi' });
        revalidatePath('/dashboard/pengaturan/users');
        return true;
    });
}
