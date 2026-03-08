// lib/auth/password.ts
// Hash dan verify password menggunakan Web Crypto API
// Tidak butuh bcrypt/argon2 — berjalan native di Cloudflare Workers

const ITERATIONS = 100_000
const HASH_ALGO = 'SHA-256'
const KEY_ALGO = 'PBKDF2'

// ============================================================
// Hash password (saat register / create user)
// ============================================================
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: KEY_ALGO },
    false,
    ['deriveBits']
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: KEY_ALGO,
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    256
  )

  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const saltArray = Array.from(salt)

  // Format: salt_hex:hash_hex
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return `${saltHex}:${hashHex}`
}

// ============================================================
// Verify password (saat login)
// ============================================================
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltHex, hashHex] = storedHash.split(':')
    if (!saltHex || !hashHex) return false

    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    )

    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: KEY_ALGO },
      false,
      ['deriveBits']
    )

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: KEY_ALGO,
        salt,
        iterations: ITERATIONS,
        hash: HASH_ALGO,
      },
      keyMaterial,
      256
    )

    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    return computedHex === hashHex
  } catch {
    return false
  }
}