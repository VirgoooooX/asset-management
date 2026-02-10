import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const options = {
    changelogCount: 30,
    bump: 'patch',
    version: undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--version' || arg === '-v') {
      options.version = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--bump') {
      options.bump = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--changelog-count') {
      options.changelogCount = Number(argv[i + 1])
      i += 1
      continue
    }
  }
  return options
}

/**
 * 运行命令并实时输出
 */
function runStreaming(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    // 在 Windows 上，npm 是 .cmd 文件，必须通过 shell 运行；而 git 是 .exe，通常不需要
    const needsShell = isWindows && command === 'npm'
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: needsShell })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1 }))
  })
}

/**
 * 运行命令并捕获输出
 */
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

/**
 * 获取 Git 变更日志
 */
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

/**
 * 更新 buildInfo.ts
 */
async function writeBuildInfo(version, changelogCount) {
  const builtAt = new Date().toISOString()
  const { head, entries } = await getGitChangelog(changelogCount)
  const moduleContent = buildInfoModule({ version, commit: head, builtAt, changelog: entries })
  const outPath = path.join(repoRoot, 'src', 'buildInfo.ts')
  await writeFile(outPath, moduleContent, 'utf8')
  console.log(`已更新 buildInfo: ${outPath}`)
}

/**
 * 等待用户输入
 */
function waitForKey(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close()
      resolve()
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rootPkgPath = path.join(repoRoot, 'package.json')
  
  // 1. 获取当前版本
  const rootPkg = await readJson(rootPkgPath)
  const currentVersion = rootPkg.version
  console.log(`当前版本: ${currentVersion}`)

  // 2. 确定目标版本
  let targetVersion = options.version
  if (!targetVersion) {
    // 如果没有指定版本，则执行 npm version bump 获取新版本号
    console.log(`正在执行 npm version ${options.bump}...`)
    await runStreaming('npm', ['version', options.bump, '--no-git-tag-version'], repoRoot)
    targetVersion = (await readJson(rootPkgPath)).version
  } else {
    console.log(`设置版本为: ${targetVersion}`)
    await runStreaming('npm', ['version', targetVersion, '--no-git-tag-version'], repoRoot)
  }

  // 同步后端版本
  console.log(`正在同步后端版本号...`)
  await runStreaming('npm', ['--prefix', 'backend', 'version', targetVersion, '--no-git-tag-version'], repoRoot)

  // 3. 更新 buildInfo
  await writeBuildInfo(targetVersion, options.changelogCount)

  // 4. Git Add
  console.log('正在暂存所有变更...')
  await runStreaming('git', ['add', '.'], repoRoot)

  // 5. 关键步骤：提示用户使用 Trae AI 按钮
  console.log('\n' + '='.repeat(60))
  console.log('★ 版本变更已就绪！现在是使用 Trae AI 提交的最佳时机 ★')
  console.log('1. 请打开 Trae 的“源代码管理”面板')
  console.log('2. 点击提交框旁边的 [AI 闪烁图标] 生成提交信息')
  console.log('3. 点击“提交 (Commit)”按钮')
  console.log('='.repeat(60) + '\n')

  await waitForKey('确认已在 Trae 中完成提交后，请按回车键继续发布流程...');

  // 6. 创建 Tag 并推送
  const tagName = `v${targetVersion}`
  console.log(`正在创建标签: ${tagName}`)
  
  // 检查 tag 是否已存在，存在则删除（可选，但发布流程通常需要干净的 tag）
  try {
    await runCapture('git', ['tag', '-d', tagName], repoRoot)
  } catch (e) { /* ignore */ }

  await runStreaming('git', ['tag', tagName], repoRoot)

  console.log('正在推送代码和标签到 GitHub...')
  await runStreaming('git', ['push', 'origin', 'main'], repoRoot) // 假设主分支是 main
  await runStreaming('git', ['push', 'origin', tagName], repoRoot)

  console.log('\n' + '='.repeat(60))
  console.log(`✅ 发布完成！GitHub Action 将自动开始构建镜像: ${tagName}`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error(`发布失败: ${err.message}`)
  process.exit(1)
})
