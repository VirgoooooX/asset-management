import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    image: 'virgoooox/asset-manage',
    changelogCount: 30,
    bump: 'patch',
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--image') {
      options.image = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--changelog-count') {
      options.changelogCount = Number(argv[i + 1])
      i += 1
      continue
    }
    if (arg === '--bump') {
      options.bump = argv[i + 1]
      i += 1
      continue
    }
    throw new Error(`未知参数: ${arg}`)
  }

  if (!options.image) throw new Error('参数错误: --image 不能为空')
  if (!Number.isFinite(options.changelogCount) || options.changelogCount <= 0) throw new Error('参数错误: --changelog-count 必须为正数')
  if (!['patch', 'minor', 'major'].includes(options.bump)) throw new Error('参数错误: --bump 仅支持 patch/minor/major')

  return options
}

function runStreaming(command, args, cwd, dryRun) {
  const printable = [command, ...args].join(' ')
  if (dryRun) {
    process.stdout.write(`${printable}\n`)
    return Promise.resolve({ code: 0 })
  }

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    // 在 Windows 上，npm 是 .cmd 文件，必须通过 shell 运行
    const needsShell = isWindows && command === 'npm'
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: needsShell })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1 }))
  })
}

async function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const needsShell = isWindows && command === 'npm'
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: needsShell })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} 失败(${code}): ${stderr || stdout}`))
    })
  })
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function safeTsString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
}

async function getGitChangelog(count) {
  const { stdout: head } = await runCapture('git', ['rev-parse', '--short', 'HEAD'], repoRoot)
  const { stdout: log } = await runCapture(
    'git',
    ['log', '-n', String(count), '--date=short', '--pretty=format:%h|%ad|%s'],
    repoRoot
  )

  const entries = log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = '', date = '', ...rest] = line.split('|')
      return { hash, date, message: rest.join('|') }
    })

  return { head: head.trim(), entries }
}

function buildInfoModule({ version, commit, builtAt, changelog }) {
  const changelogJson = JSON.stringify(changelog, null, 2)
  const escaped = safeTsString(changelogJson)
  return `export type ChangelogEntry = { hash: string; date: string; message: string }\n\nexport type BuildInfo = {\n  version: string\n  commit: string\n  builtAt: string\n  changelog: ChangelogEntry[]\n}\n\nexport const buildInfo: BuildInfo = {\n  version: '${safeTsString(version)}',\n  commit: '${safeTsString(commit)}',\n  builtAt: '${safeTsString(builtAt)}',\n  changelog: JSON.parse(\`${escaped}\`) as ChangelogEntry[],\n}\n`
}

async function writeBuildInfo(version, changelogCount, dryRun) {
  const builtAt = new Date().toISOString()
  const { head, entries } = await getGitChangelog(changelogCount)
  const moduleContent = buildInfoModule({ version, commit: head, builtAt, changelog: entries })
  const outPath = path.join(repoRoot, 'src', 'buildInfo.ts')
  if (dryRun) {
    process.stdout.write(`将写入 ${outPath}\n`)
    process.stdout.write(`version=${version}\n`)
    process.stdout.write(`commit=${head}\n`)
    process.stdout.write(`changelogCount=${entries.length}\n`)
    return
  }
  await writeFile(outPath, moduleContent, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const rootPkgPath = path.join(repoRoot, 'package.json')
  const rootPkg = await readJson(rootPkgPath)
  const version = rootPkg.version
  if (typeof version !== 'string' || !version) throw new Error('package.json 缺少 version 字段')

  await writeBuildInfo(version, options.changelogCount, options.dryRun)

  const imageLatest = `${options.image}:latest`
  const imageVersion = `${options.image}:${version}`

  const buildResult = await runStreaming('docker', ['build', '-t', imageLatest, '-t', imageVersion, '.'], repoRoot, options.dryRun)
  if (buildResult.code !== 0) {
    console.error('Docker 构建失败')
    process.exit(buildResult.code)
  }

  console.log(`推送镜像: ${imageVersion}`)
  const pushVersion = await runStreaming('docker', ['push', imageVersion], repoRoot, options.dryRun)
  if (pushVersion.code !== 0) {
    console.error('Docker 推送版本镜像失败')
    process.exit(pushVersion.code)
  }

  console.log(`推送镜像: ${imageLatest}`)
  const pushLatest = await runStreaming('docker', ['push', imageLatest], repoRoot, options.dryRun)
  if (pushLatest.code !== 0) {
    console.error('Docker 推送 latest 镜像失败')
    process.exit(pushLatest.code)
  }

  console.log('推送成功，正在递增版本号...')
  const bumpRoot = await runStreaming('npm', ['version', options.bump, '--no-git-tag-version'], repoRoot, options.dryRun)
  if (bumpRoot.code !== 0) {
    console.error('根目录版本号递增失败')
    process.exit(bumpRoot.code)
  }

  const bumpBackend = await runStreaming('npm', ['--prefix', 'backend', 'version', options.bump, '--no-git-tag-version'], repoRoot, options.dryRun)
  if (bumpBackend.code !== 0) {
    console.error('后端目录版本号递增失败')
    process.exit(bumpBackend.code)
  }

  console.log('发布流程完成！')
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

