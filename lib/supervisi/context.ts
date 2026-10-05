import type { Context, Teacher } from './types';

export function timeLabel(sessions: string[]) {
    const ordered = ['shubuh', 'ashar', 'maghrib'].filter(s => sessions.includes(s));
    if (ordered.length === 3) return 'Semua waktu';
    return ordered.map(s => ({ shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' })[s]).join(' dan ');
}

export function classContext(teacher: Teacher, classId?: string): Context | null {
    if (!teacher) return null;

    // Jika kelas spesifik ditentukan (misal untuk kompatibilitas filter/tes)
    if (classId && classId !== 'all') {
        const kelas = teacher.classes?.find(c => c.id === classId);
        const contexts = teacher.contexts?.filter(c => c.kelas_id === classId);
        if (!kelas || !contexts?.length) return null;
        const books = [...new Map(contexts.map(c => [c.kitab_id, c])).values()];
        return {
            ...contexts[0],
            key: classId,
            kelas_nama: kelas.nama,
            hari: '',
            sesi: timeLabel(kelas.sessions),
            sessions: [...kelas.sessions],
            kitab: books.map(c => ({ id: c.kitab_id, nama: c.kitab_nama, mapel: c.mapel_nama })),
            kitab_nama: books.map(c => c.kitab_nama).join('; '),
            mapel_nama: [...new Set(books.map(c => c.mapel_nama))].join('; '),
        };
    }

    // Seluruh kelas guru digabungkan secara otomatis (semua kelas yang diajar)
    const classes = teacher.classes ?? [];
    const contexts = teacher.contexts ?? [];
    if (!classes.length && !contexts.length) return null;

    const classNames = classes.length
        ? classes.map(c => c.nama).join(', ')
        : (teacher.kelas?.join(', ') || 'Semua Kelas');

    const sessions = [...new Set(classes.flatMap(c => c.sessions))];
    const books = [...new Map(contexts.map(c => [c.kitab_id, c])).values()];

    const firstContext = contexts[0] ?? {
        key: 'all',
        kelas_id: classes[0]?.id ?? '',
        kelas_nama: classNames,
        sesi: '',
        hari: '',
        kitab_id: 0,
        kitab_nama: '',
        mapel_nama: '',
    };

    return {
        ...firstContext,
        key: 'all',
        kelas_id: classes.map(c => c.id).join(','),
        kelas_nama: classNames,
        hari: '',
        sesi: timeLabel(sessions),
        sessions,
        kitab: books.map(c => ({ id: c.kitab_id, nama: c.kitab_nama, mapel: c.mapel_nama })),
        kitab_nama: books.map(c => c.kitab_nama).join('; '),
        mapel_nama: [...new Set(books.map(c => c.mapel_nama))].join('; '),
    };
}

export function contextTime(context: Context) {
    return context.hari ? context.hari + ', ' + (timeLabel([context.sesi]) || context.sesi) : context.sesi;
}

export function contextBooks(context: Context) {
    return context.kitab?.length ? context.kitab.map(k => k.nama + ' / ' + k.mapel).join('; ') : context.kitab_nama + ' / ' + context.mapel_nama;
}
