import type { Answers } from './instrument';
export type SavePayload = {
    id: string;
    revision: number;
    operationId: string;
    patch: Answers;
    tanggal?: string;
};
export type SaveResponse = {
    ok: true;
    data: {
        revision: number;
        replayed: boolean;
    };
} | {
    ok: false;
    error: string;
};
/** Single in-flight operation; its ID and payload survive ambiguous network errors. */
export class AutosaveQueue {
    revision: number;
    pending: Answers = {};
    tanggal: string | undefined;
    inflight: SavePayload | null = null;
    private running: Promise<boolean> | null = null;
    conflict = false;
    stopped = false;
    error = '';
    constructor(private id: string, revision: number, private save: (p: SavePayload) => Promise<SaveResponse>, private notify: () => void) { this.revision = revision; }
    get dirty() { return !!this.inflight || !!Object.keys(this.pending).length || this.tanggal !== undefined; }
    get saving() { return !!this.running; }
    edit(id: string, value: Answers[string]) { this.pending[id] = value; this.notify(); }
    setDate(date: string) { this.tanggal = date; this.notify(); }
    flush(): Promise<boolean> {
        if (this.running)
            return this.running;
        if (this.conflict || this.stopped)
            return Promise.resolve(false);
        this.running = this.drain().finally(() => { this.running = null; this.notify(); });
        this.notify();
        return this.running;
    }
    private async drain() {
        while (this.dirty && !this.stopped) {
            if (!this.inflight) {
                this.inflight = { id: this.id, revision: this.revision, operationId: crypto.randomUUID(), patch: this.pending, ...(this.tanggal !== undefined ? { tanggal: this.tanggal } : {}) };
                this.pending = {};
                this.tanggal = undefined;
            }
            try {
                const result = await this.save(this.inflight);
                if (!result.ok) {
                    this.error = result.error;
                    this.conflict = result.error.startsWith('CONFLICT:');
                    this.notify();
                    return false;
                }
                this.revision = result.data.revision;
                this.inflight = null;
                this.error = '';
                this.notify();
            }
            catch {
                this.error = 'Koneksi terputus. Jawaban belum tersimpan; akan dicoba kembali.';
                this.notify();
                return false;
            }
        }
        return !this.dirty;
    }
    /** Called only after the user explicitly reviews the newly fetched server version. */
    rebase(revision: number) {
        this.pending = { ...(this.inflight?.patch ?? {}), ...this.pending };
        this.tanggal = this.tanggal ?? this.inflight?.tanggal;
        this.inflight = null;
        this.revision = revision;
        this.conflict = false;
        this.error = '';
        this.notify();
    }
}
