import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const SCRYPT_PREFIX = 'scrypt'
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 64

const scryptAsync = (password: string, salt: string, keylen: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scryptAsync(plain, salt, SCRYPT_KEYLEN)
  return `${SCRYPT_PREFIX}$${salt}$${derived.toString('hex')}`
}

export const verifyPassword = async (
  plain: string,
  storedHash: string
): Promise<{ ok: boolean; needsRehash: boolean }> => {
  if (!storedHash) return { ok: false, needsRehash: false }

  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const parts = storedHash.split('$')
    if (parts.length !== 3) return { ok: false, needsRehash: false }
    const [, salt, expectedHex] = parts
    if (!salt || !expectedHex) return { ok: false, needsRehash: false }
    const expected = Buffer.from(expectedHex, 'hex')
    const derived = await scryptAsync(plain, salt, expected.length)
    const ok = derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
    return { ok, needsRehash: false }
  }

  const ok = await bcrypt.compare(plain, storedHash)
  return { ok, needsRehash: ok }
}
