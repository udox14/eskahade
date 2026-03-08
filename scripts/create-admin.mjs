import { pbkdf2, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
const p = promisify(pbkdf2);
const salt = randomBytes(16);
const hash = await p('Admin@123', salt, 100000, 32, 'sha256');
const h = salt.toString('hex') + ':' + hash.toString('hex');
const id = randomUUID();
const now = new Date().toISOString();
console.log("npx wrangler d1 execute eskahade-db --remote --command=\"INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at) VALUES ('" + id + "', 'admin@sukahideng.com', '" + h + "', 'Administrator', 'admin', 1, '" + now + "', '" + now + "');\"");