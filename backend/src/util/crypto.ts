import crypto from 'node:crypto'

export const randomToken = (bytes: number) => crypto.randomBytes(bytes).toString('hex')

export const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

