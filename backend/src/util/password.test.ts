import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword, verifyPassword } from './password'

describe('password util', () => {
  it('hashes and verifies with scrypt without needing rehash', async () => {
    const hash = await hashPassword('secret-pass-123')
    expect(hash.startsWith('scrypt$')).toBe(true)

    const valid = await verifyPassword('secret-pass-123', hash)
    expect(valid).toEqual({ ok: true, needsRehash: false })

    const invalid = await verifyPassword('wrong-pass', hash)
    expect(invalid).toEqual({ ok: false, needsRehash: false })
  })

  it('verifies legacy bcrypt hashes and signals needsRehash', async () => {
    const legacy = await bcrypt.hash('legacy-pass', 4)
    const valid = await verifyPassword('legacy-pass', legacy)
    expect(valid).toEqual({ ok: true, needsRehash: true })

    const invalid = await verifyPassword('wrong-pass', legacy)
    expect(invalid).toEqual({ ok: false, needsRehash: false })
  })
})
