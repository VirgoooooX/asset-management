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
    platform: 'linux/amd64,linux/arm64',
    version: undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--version') {
      options.version = argv[i + 1]
      i += 1
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
    if (arg === '--platform') {
      options.platform = argv[i + 1]
      i += 1
      continue
    }
    throw new Error(`未知参数: ${arg}`)
  }

  if (!options.image) throw new Error('参数错误: --image 不能为空')
  if (options.version !== undefined) {
    const version = String(options.version)
    const semverLike = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
    if (!semverLike.test(version)) throw new Error('参数错误: --version 必须是 semver 格式，例如 1.2.3 或 1.2.3-beta.1')
  }
  if (!Number.isFinite(options.changelogCount) || options.changelogCount <= 0) throw new Error('参数错误: --changelog-count 必须为正数')
  if (!['patch', 'minor', 'major'].includes(options.bump)) throw new Error('参数错误: --bump 仅支持 patch/minor/major')
  if (!options.platform) throw new Error('参数错误: --platform 不能为空')

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

async function ensureBuilder(dryRun) {
  if (dryRun) return
  console.log('检查 Docker Buildx 构建器...')
  try {
    const { stdout } = await runCapture('docker', ['buildx', 'ls'], repoRoot)
    // 检查是否有 docker-container 驱动的构建器且已在运行或可用
    const lines = stdout.split('\n')
    const hasContainerDriver = lines.some((line) => line.includes('docker-container'))

    if (!hasContainerDriver) {
      console.log('未发现 docker-container 驱动的构建器，正在创建...')
      await runStreaming('docker', ['buildx', 'create', '--name', 'chamber-builder', '--driver', 'docker-container', '--use'], repoRoot, false)
    } else {
      // 找到第一个 docker-container 驱动的构建器名称
      const builderLine = lines.find((line) => line.includes('docker-container'))
      const builderName = builderLine.trim().split(/\s+/)[0]
      console.log(`使用现有构建器: ${builderName}`)
      await runStreaming('docker', ['buildx', 'use', builderName], repoRoot, false)
    }
  } catch (err) {
    console.warn('无法检查或切换构建器，尝试继续使用默认构建器:', err.message)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const rootPkgPath = path.join(repoRoot, 'package.json')
  const backendPkgPath = path.join(repoRoot, 'backend', 'package.json')

  const rootPkgBefore = await readJson(rootPkgPath)
  const versionBefore = rootPkgBefore.version
  if (typeof versionBefore !== 'string' || !versionBefore) throw new Error('package.json 缺少 version 字段')

  if (options.version !== undefined) {
    const targetVersion = String(options.version)
    if (versionBefore !== targetVersion) {
      console.log(`设置发布版本号: ${targetVersion}`)
      const setRoot = await runStreaming('npm', ['version', targetVersion, '--no-git-tag-version'], repoRoot, options.dryRun)
      if (setRoot.code !== 0) {
        console.error('根目录版本号设置失败')
        process.exit(setRoot.code)
      }
    }

    const backendPkgBefore = await readJson(backendPkgPath)
    const backendVersionBefore = backendPkgBefore.version
    if (typeof backendVersionBefore !== 'string' || !backendVersionBefore) throw new Error('backend/package.json 缺少 version 字段')
    if (backendVersionBefore !== targetVersion) {
      const setBackend = await runStreaming(
        'npm',
        ['--prefix', 'backend', 'version', targetVersion, '--no-git-tag-version'],
        repoRoot,
        options.dryRun
      )
      if (setBackend.code !== 0) {
        console.error('后端目录版本号设置失败')
        process.exit(setBackend.code)
      }
    }
  }

  const version =
    options.version !== undefined
      ? options.dryRun
        ? String(options.version)
        : (await readJson(rootPkgPath)).version
      : versionBefore
  if (typeof version !== 'string' || !version) throw new Error('package.json 缺少 version 字段')

  await ensureBuilder(options.dryRun)
  await writeBuildInfo(version, options.changelogCount, options.dryRun)

  const imageLatest = `${options.image}:latest`
  const imageVersion = `${options.image}:${version}`

  console.log(`正在构建并推送多架构镜像: ${options.platform}`)
  const buildResult = await runStreaming(
    'docker',
    ['buildx', 'build', '--platform', options.platform, '-t', imageLatest, '-t', imageVersion, '--push', '.'],
    repoRoot,
    options.dryRun
  )

  if (buildResult.code !== 0) {
    console.error('Docker 构建或推送失败')
    process.exit(buildResult.code)
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
