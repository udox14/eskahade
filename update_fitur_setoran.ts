import { execute } from './lib/db/index';

async function main() {
    await execute("UPDATE fitur_akses SET is_active = 0 WHERE href = '/dashboard/asrama/status-setoran'");
    console.log("Updated fitur_akses: deactivated status-setoran");
}

main().catch(console.error);
