import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(here, '..')
const srcDir = path.join(backendDir, 'src', 'db', 'migrations')
const outDir = path.join(backendDir, 'build', 'db', 'migrations')

if (!fs.existsSync(srcDir)) {
  throw new Error(`Migrations source dir not found: ${srcDir}`)
}

fs.mkdirSync(outDir, { recursive: true })

for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (!entry.name.toLowerCase().endsWith('.sql')) continue
  fs.copyFileSync(path.join(srcDir, entry.name), path.join(outDir, entry.name))
}
