import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    bump: 'patch',
    changelogCount: 30,
    dryRun: false,
    skipChecks: false,
    skipGitHubRelease: false,
    skipPush: false,
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
    if (arg === '--dry-run' || arg === '--release-dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--skip-checks') {
      options.skipChecks = true
      continue
    }
    if (arg === '--skip-github-release') {
      options.skipGitHubRelease = true
      continue
    }
    if (arg === '--skip-push') {
      options.skipPush = true
      continue
    }
  }

  return options
}

function isWindowsShellCommand(command) {
  return process.platform === 'win32' && ['npm', 'npx'].includes(command)
}

function formatCommand(command, args) {
  return [command, ...args].join(' ')
}

function run(command, args, { cwd = repoRoot, capture = false, dryRun = false } = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${formatCommand(command, args)}`)
    return Promise.resolve({ stdout: '', stderr: '', code: 0 })
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: isWindowsShellCommand(command),
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })

    let stdout = ''
    let stderr = ''
    if (capture) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code: code ?? 0 })
      } else {
        reject(new Error(`${formatCommand(command, args)} failed with exit code ${code}\n${stderr || stdout}`))
      }
    })
  })
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function bumpVersion(currentVersion, bump) {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/)
  if (!match) {
    throw new Error(`Cannot bump non-semver version: ${currentVersion}`)
  }

  const [, majorRaw, minorRaw, patchRaw] = match
  let major = Number(majorRaw)
  let minor = Number(minorRaw)
  let patch = Number(patchRaw)

  if (bump === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (bump === 'minor') {
    minor += 1
    patch = 0
  } else if (bump === 'patch') {
    patch += 1
  } else {
    throw new Error(`Unsupported --bump value: ${bump}. Use major, minor, or patch.`)
  }

  return `${major}.${minor}.${patch}`
}

function safeTsString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('`', '\\`').replaceAll('${', '\\${')
}

async function getGitChangelog(count) {
  const { stdout: head } = await run('git', ['rev-parse', '--short', 'HEAD'], { capture: true })
  const { stdout: log } = await run(
    'git',
    ['log', '-n', String(count), '--date=short', '--pretty=format:%h|%ad|%s'],
    { capture: true }
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

async function writeBuildInfo(version, changelogCount) {
  const builtAt = new Date().toISOString()
  const { head, entries } = await getGitChangelog(changelogCount)
  const moduleContent = buildInfoModule({ version, commit: head, builtAt, changelog: entries })
  const outPath = path.join(repoRoot, 'src', 'buildInfo.ts')
  await writeFile(outPath, moduleContent, 'utf8')
  console.log(`Updated buildInfo: ${path.relative(repoRoot, outPath)}`)
}

async function getRepoSlug() {
  const { stdout } = await run('gh', ['repo', 'view', '--json', 'owner,name', '--jq', '.owner.login + "/" + .name'], {
    capture: true,
  })
  const slug = stdout.trim()
  if (!slug.includes('/')) {
    throw new Error('Unable to resolve GitHub repository slug with gh.')
  }
  return slug
}

async function ensureCommand(command, args) {
  await run(command, args, { capture: true })
}

async function ensureTagDoesNotExist(tagName) {
  const { stdout } = await run('git', ['tag', '--list', tagName], { capture: true })
  if (stdout.trim()) {
    throw new Error(`Local tag already exists: ${tagName}`)
  }

  const remote = await run('git', ['ls-remote', '--tags', 'origin', tagName], { capture: true })
  if (remote.stdout.trim()) {
    throw new Error(`Remote tag already exists: ${tagName}`)
  }
}

async function updatePackageVersions(targetVersion, dryRun) {
  const files = [
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'package-lock.json'),
    path.join(repoRoot, 'backend', 'package.json'),
    path.join(repoRoot, 'backend', 'package-lock.json'),
  ]

  for (const filePath of files) {
    const json = await readJson(filePath)
    json.version = targetVersion

    if (json.packages?.['']?.version) {
      json.packages[''].version = targetVersion
    }

    if (!dryRun) {
      await writeJson(filePath, json)
    }
    console.log(`${dryRun ? '[dry-run] Would update' : 'Updated'} ${path.relative(repoRoot, filePath)} -> ${targetVersion}`)
  }
}

async function runChecks(options) {
  if (options.skipChecks) {
    console.log('Skipping checks.')
    return
  }

  await run('npm', ['run', 'typecheck'])
  await run('npm', ['run', 'test'])
  await run('npm', ['run', 'build'])
  await run('npm', ['--prefix', 'backend', 'run', 'build'])
}

async function stageReleaseFiles() {
  const trackedChanges = await run('git', ['diff', '--name-only'], { capture: true })
  const trackedFiles = trackedChanges.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const releaseFiles = [
    'package.json',
    'package-lock.json',
    'backend/package.json',
    'backend/package-lock.json',
    'src/buildInfo.ts',
    'scripts/release.mjs',
    '.github/workflows/docker-release.yml',
    'README.md',
    'LICENSE',
  ]

  const filesToStage = Array.from(new Set([...trackedFiles, ...releaseFiles]))
  await run('git', ['add', '--', ...filesToStage])
}

async function hasStagedChanges() {
  const { stdout } = await run('git', ['diff', '--cached', '--name-only'], { capture: true })
  return Boolean(stdout.trim())
}

async function createCommit(targetVersion, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] Stage release files and commit: chore: release ${targetVersion}`)
    return
  }

  await stageReleaseFiles()

  if (!(await hasStagedChanges())) {
    console.log('No staged changes to commit.')
    return
  }

  await run('git', ['commit', '-m', `chore: release ${targetVersion}`], { dryRun })
}

async function createReleaseNotes({ targetVersion, imageName, changelogCount }) {
  const { entries } = await getGitChangelog(changelogCount)
  const changelog = entries
    .slice(0, changelogCount)
    .map((entry) => `- ${entry.hash} ${entry.message}`)
    .join('\n')

  const notes = `## Chamber Tracker ${targetVersion}

### Container image

\`\`\`bash
docker pull ${imageName}:${targetVersion}
docker pull ${imageName}:latest
\`\`\`

The Docker Release workflow builds and publishes multi-arch images for \`linux/amd64\` and \`linux/arm64\` to GitHub Container Registry.

### Recent changes

${changelog || '- No changelog entries found.'}
`

  const notesDir = path.join(os.tmpdir(), 'chamber-tracker-release')
  await mkdir(notesDir, { recursive: true })
  const notesPath = path.join(notesDir, `release-${targetVersion}.md`)
  await writeFile(notesPath, notes, 'utf8')
  return notesPath
}

async function createGitHubRelease({ tagName, targetVersion, imageName, changelogCount, dryRun }) {
  const notesPath = await createReleaseNotes({ targetVersion, imageName, changelogCount })
  try {
    await run(
      'gh',
      [
        'release',
        'create',
        tagName,
        '--title',
        `Chamber Tracker ${targetVersion}`,
        '--notes-file',
        notesPath,
      ],
      { dryRun }
    )
  } finally {
    await rm(notesPath, { force: true })
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rootPkgPath = path.join(repoRoot, 'package.json')
  const rootPkg = await readJson(rootPkgPath)
  const currentVersion = rootPkg.version
  const targetVersion = options.version ?? bumpVersion(currentVersion, options.bump)
  const tagName = targetVersion

  console.log(`Current version: ${currentVersion}`)
  console.log(`Target version: ${targetVersion}`)

  await ensureCommand('git', ['--version'])
  await ensureCommand('gh', ['--version'])
  await run('gh', ['auth', 'status'], { capture: true })
  await ensureTagDoesNotExist(tagName)

  const repoSlug = await getRepoSlug()
  const imageName = `ghcr.io/${repoSlug.toLowerCase()}`

  await updatePackageVersions(targetVersion, options.dryRun)
  if (options.dryRun) {
    console.log(`[dry-run] Update src/buildInfo.ts -> ${targetVersion}`)
    console.log('[dry-run] Skip checks and file staging.')
  } else {
    await writeBuildInfo(targetVersion, options.changelogCount)
    await runChecks(options)
  }
  await createCommit(targetVersion, options.dryRun)
  await run('git', ['tag', tagName], { dryRun: options.dryRun })

  if (options.skipPush) {
    console.log(`Created local release commit and tag ${tagName}; skipping push.`)
  } else {
    const currentBranch = options.dryRun
      ? { stdout: 'main\n' }
      : await run('git', ['branch', '--show-current'], { capture: true })
    const branchName = currentBranch.stdout.trim() || 'main'
    await run('git', ['push', 'origin', branchName], { dryRun: options.dryRun })
    await run('git', ['push', 'origin', tagName], { dryRun: options.dryRun })
  }

  if (options.skipGitHubRelease) {
    console.log('Skipping GitHub Release creation.')
  } else {
    await createGitHubRelease({
      tagName,
      targetVersion,
      imageName,
      changelogCount: options.changelogCount,
      dryRun: options.dryRun,
    })
  }

  console.log(options.dryRun ? '\nRelease dry-run complete.' : '\nRelease published.')
  console.log(`Tag: ${tagName}`)
  console.log(`Image: ${imageName}:${targetVersion}`)
}

main().catch((error) => {
  console.error(`Release failed: ${error.message}`)
  process.exit(1)
})
