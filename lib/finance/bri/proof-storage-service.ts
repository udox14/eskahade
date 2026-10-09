// lib/finance/bri/proof-storage-service.ts
// Layanan Penyimpanan Bukti Transaksi Finansial Terisolasi (Private R2 Bucket & Reference Fallback)
// Memenuhi aturan integritas finansial, MIME/Magic-Bytes, SHA-256 hash, dan Role-Based Access Control (RBAC)

import crypto from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getBriFeatureFlags } from './feature-flags'
import type {
  ProofUploadValidationInput,
  ProofUploadValidationResult,
} from './cash-manual-distribution-types'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const AUTHORIZED_RETRIEVAL_ROLES = new Set([
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
])

export interface StoreFinancialProofInput {
  buffer: Buffer | Uint8Array
  mimeType: string
  originalFilename: string
  sizeBytes?: number
  distributionId?: string
  operatorId: string
  operatorRole: string
  customBucket?: any // Optional passed R2Bucket instance
}

export interface StoreFinancialProofResult {
  success: boolean
  proofId: string
  objectKey: string
  hash: string
  mimeType: string
  sizeBytes: number
  storageMode: 'R2' | 'REFERENCE_FALLBACK'
  error?: string
}

export interface GetFinancialProofInput {
  objectKey: string
  operatorRole: string
  operatorId: string
  customBucket?: any
}

export interface GetFinancialProofResult {
  success: boolean
  buffer?: Buffer | Uint8Array
  mimeType?: string
  sizeBytes?: number
  error?: string
}

export class ProofStorageService {
  /**
   * Sniff magic bytes to prevent MIME-spoofing attacks.
   */
  validateMagicBytes(buffer: Uint8Array | Buffer, mime: string): boolean {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    if (buf.length < 4) return false

    if (mime === 'application/pdf') {
      return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
    }
    if (mime === 'image/jpeg') {
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    }
    if (mime === 'image/png') {
      return buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    }
    if (mime === 'image/webp') {
      return (
        buf.length >= 12 &&
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      )
    }
    return false
  }

  /**
   * Validasi struktur dan integritas berkas bukti.
   */
  validateProofInput(input: ProofUploadValidationInput): ProofUploadValidationResult {
    if (!input || !input.buffer) {
      return { valid: false, error: 'Berkas bukti tidak ditemukan atau kosong.' }
    }

    const mime = (input.mimeType || '').toLowerCase().trim()
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return {
        valid: false,
        error: `Tipe file "${input.mimeType}" tidak diizinkan. Hanya JPEG, PNG, WEBP, dan PDF yang diperbolehkan.`,
      }
    }

    const size = input.sizeBytes || input.buffer.length
    if (size > MAX_PROOF_FILE_SIZE) {
      return {
        valid: false,
        error: `Ukuran file melebihi batas maksimum 5 MB (ukuran file: ${(size / (1024 * 1024)).toFixed(2)} MB).`,
      }
    }

    const cleanFilename = input.originalFilename || 'proof'
    if (
      cleanFilename.includes('..') ||
      cleanFilename.includes('/') ||
      cleanFilename.includes('\\') ||
      cleanFilename.startsWith('http://') ||
      cleanFilename.startsWith('https://')
    ) {
      return {
        valid: false,
        error: 'Nama file tidak aman: mengandung karakter path traversal atau format URL eksternal.',
      }
    }

    if (!this.validateMagicBytes(input.buffer, mime)) {
      return {
        valid: false,
        error: `MAGIC_BYTES_MISMATCH: Konten biner file tidak cocok dengan tipe MIME yang diklaim ("${mime}").`,
      }
    }

    let ext = 'bin'
    if (mime === 'image/jpeg') ext = 'jpg'
    else if (mime === 'image/png') ext = 'png'
    else if (mime === 'image/webp') ext = 'webp'
    else if (mime === 'application/pdf') ext = 'pdf'

    const uuid = crypto.randomUUID()
    const objectKey = `proofs/financial/${uuid}.${ext}`
    const proofId = `PRF-${uuid.substring(0, 12)}`
    const hash = crypto.createHash('sha256').update(input.buffer).digest('hex')

    return {
      valid: true,
      proofId,
      proofRef: objectKey,
      objectKey,
      hash,
      mimeType: mime,
      sizeBytes: size,
    }
  }

  /**
   * Menyimpan berkas bukti ke Private R2 Bucket (atau Fallback Reference Mode jika R2 tidak terkonfigurasi).
   */
  async storeFinancialProof(input: StoreFinancialProofInput): Promise<StoreFinancialProofResult> {
    const validation = this.validateProofInput({
      buffer: input.buffer,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      sizeBytes: input.sizeBytes || input.buffer.length,
    })

    if (!validation.valid || !validation.objectKey || !validation.proofId || !validation.hash) {
      return {
        success: false,
        proofId: '',
        objectKey: '',
        hash: '',
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes || 0,
        storageMode: 'REFERENCE_FALLBACK',
        error: validation.error || 'Validasi berkas bukti gagal.',
      }
    }

    let bucket = input.customBucket
    if (!bucket) {
      try {
        const { env } = await getCloudflareContext({ async: true })
        if (env && env.R2_BUCKET) {
          bucket = env.R2_BUCKET
        }
      } catch {
        // Lingkungan tanpa Cloudflare Context (misal testing lokal / seeder)
      }
    }

    if (bucket && typeof bucket.put === 'function') {
      try {
        await bucket.put(validation.objectKey, input.buffer, {
          httpMetadata: {
            contentType: validation.mimeType,
          },
          customMetadata: {
            proofId: validation.proofId,
            sha256: validation.hash,
            distributionId: input.distributionId || 'N/A',
            operatorId: input.operatorId,
            operatorRole: input.operatorRole,
            storedAt: new Date().toISOString(),
          },
        })

        return {
          success: true,
          proofId: validation.proofId,
          objectKey: validation.objectKey,
          hash: validation.hash,
          mimeType: validation.mimeType || input.mimeType,
          sizeBytes: validation.sizeBytes ?? input.buffer.length,
          storageMode: 'R2',
        }
      } catch (err: any) {
        return {
          success: false,
          proofId: validation.proofId,
          objectKey: validation.objectKey,
          hash: validation.hash,
          mimeType: validation.mimeType || input.mimeType,
          sizeBytes: validation.sizeBytes ?? input.buffer.length,
          storageMode: 'REFERENCE_FALLBACK',
          error: `Gagal menyimpan ke R2: ${err?.message || String(err)}`,
        }
      }
    }

    const flags = getBriFeatureFlags()
    if (flags.environment === 'production') {
      return {
        success: false,
        proofId: validation.proofId,
        objectKey: validation.objectKey,
        hash: validation.hash,
        mimeType: validation.mimeType || input.mimeType,
        sizeBytes: validation.sizeBytes ?? input.buffer.length,
        storageMode: 'R2',
        error:
          'R2_BUCKET_UNAVAILABLE: Penyimpanan bukti transaksi privat wajib menggunakan Cloudflare R2 di lingkungan produksi. Fallback mode dilarang keras.',
      }
    }

    // Reference fallback mode: hanya diizinkan di lingkungan non-produksi (test/lokal)
    return {
      success: true,
      proofId: validation.proofId,
      objectKey: validation.objectKey,
      hash: validation.hash,
      mimeType: validation.mimeType || input.mimeType,
      sizeBytes: validation.sizeBytes ?? input.buffer.length,
      storageMode: 'REFERENCE_FALLBACK',
    }
  }

  /**
   * Mengambil berkas bukti dengan penjagaan otorisasi RBAC ketat.
   */
  async getFinancialProof(input: GetFinancialProofInput): Promise<GetFinancialProofResult> {
    if (!AUTHORIZED_RETRIEVAL_ROLES.has(input.operatorRole)) {
      return {
        success: false,
        error: `UNAUTHORIZED_ACCESS: Peran "${input.operatorRole}" tidak memiliki wewenang untuk melihat bukti transaksi finansial privat.`,
      }
    }

    let bucket = input.customBucket
    if (!bucket) {
      try {
        const { env } = await getCloudflareContext({ async: true })
        if (env && env.R2_BUCKET) {
          bucket = env.R2_BUCKET
        }
      } catch {
        // Lingkungan lokal
      }
    }

    if (!bucket || typeof bucket.get !== 'function') {
      return {
        success: false,
        error: 'STORAGE_UNAVAILABLE: Private R2 Bucket tidak tersedia pada lingkungan ini.',
      }
    }

    try {
      const obj = await bucket.get(input.objectKey)
      if (!obj) {
        return {
          success: false,
          error: `NOT_FOUND: Berkas bukti dengan key "${input.objectKey}" tidak ditemukan di R2.`,
        }
      }

      const arrayBuffer = await obj.arrayBuffer()
      const mime = obj.httpMetadata?.contentType || 'application/octet-stream'

      return {
        success: true,
        buffer: Buffer.from(arrayBuffer),
        mimeType: mime,
        sizeBytes: obj.size,
      }
    } catch (err: any) {
      return {
        success: false,
        error: `STORAGE_ERROR: Gagal membaca berkas bukti: ${err?.message || String(err)}`,
      }
    }
  }

  /**
   * Memvalidasi apakah buffer memiliki hash yang persis sesuai dengan expectedHash.
   */
  verifyProofIntegrity(buffer: Buffer | Uint8Array, expectedHash: string): boolean {
    const computed = crypto.createHash('sha256').update(buffer).digest('hex')
    return computed.toLowerCase() === expectedHash.toLowerCase()
  }
}

export const proofStorageService = new ProofStorageService()
