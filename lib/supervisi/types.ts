import type { Answers } from './instrument';
export type Context = {
    key: string;
    kelas_id: string;
    kelas_nama: string;
    sesi: string;
    hari: string;
    kitab_id: number;
    kitab_nama: string;
    mapel_nama: string;
};
export type Teacher = {
    id: number;
    nama: string;
    contexts: Context[];
    kelas: string[];
};
export type Activity = {
    id: string;
    nama: string;
    tahun_ajaran_id: number;
    tahun_nama: string;
    status: 'persiapan' | 'terbuka' | 'ditutup';
    revision: number;
};
export type Identity = Context & {
    guru_nama: string;
    pewawancara: string;
    kegiatan_nama: string;
    tahun_nama: string;
};
export type Interview = {
    id: string;
    kegiatan_id: string;
    guru_id: number;
    owner_id: string;
    status: 'draft' | 'selesai';
    tanggal: string;
    revision: number;
    answers: Answers;
    identity: Identity;
    editable: boolean;
    admin: boolean;
    activityOpen: boolean;
};
export type Coverage = {
    guru_id: number;
    guru_nama: string;
    kelas: string[];
    status: 'belum' | 'draft' | 'selesai';
    completed_count: number;
    interview_id: string | null;
    accessible: boolean;
};
