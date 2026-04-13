import * as fs from 'fs'
import * as path from 'path'

type VerifyMode = 'after-test' | 'after-clean-test'

const testDirectory = path.resolve(__dirname, 'test')

function getRecursiveFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return []
  }

  const files: string[] = []
  const pendingDirectories: string[] = [rootDir]

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()
    if (!currentDirectory) {
      continue
    }

    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(currentDirectory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          continue
        }
        pendingDirectories.push(fullPath)
        continue
      }

      if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function isSourceFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx')
}

function isGeneratedSidecarFile(filePath: string): boolean {
  return (
    /-sidecar\.(ts|tsx)$/.test(filePath) ||
    /\.sidecar\.(ts|tsx)$/.test(filePath)
  )
}

function shouldCheckSourceFile(filePath: string): boolean {
  if (!isSourceFile(filePath)) {
    return false
  }

  if (isGeneratedSidecarFile(filePath)) {
    return false
  }

  return true
}

function getExpectedSidecarFilename(filePath: string): string {
  const extension = path.extname(filePath)
  const pathWithoutExtension = filePath.slice(
    0,
    filePath.length - extension.length,
  )
  return `${pathWithoutExtension}-sidecar.ts`
}

function failWithIssues(issues: string[]): never {
  for (const issue of issues) {
    console.error(issue)
  }

  process.exit(1)
}

function verifyAfterTest(allFiles: string[]): void {
  const issues: string[] = []
  const sourceFiles = allFiles.filter(shouldCheckSourceFile)

  for (const sourceFile of sourceFiles) {
    const sidecarFile = getExpectedSidecarFilename(sourceFile)
    const basename = path.basename(sourceFile)
    const shouldHaveSidecar = !basename.includes('ignoreMe')
    const hasSidecar = fs.existsSync(sidecarFile)

    if (shouldHaveSidecar && !hasSidecar) {
      issues.push(`Missing sidecar for ${path.relative(testDirectory, sourceFile)}`)
    }

    if (!shouldHaveSidecar && hasSidecar) {
      issues.push(
        `Unexpected sidecar for ignored file ${path.relative(testDirectory, sourceFile)}`,
      )
    }
  }

  if (issues.length > 0) {
    failWithIssues(issues)
  }

  console.log('test verification passed')
}

function verifyAfterCleanTest(allFiles: string[]): void {
  const remainingSidecars = allFiles.filter(isGeneratedSidecarFile)
  if (remainingSidecars.length === 0) {
    console.log('clean-test verification passed')
    return
  }

  const issues = remainingSidecars.map(
    (filePath) =>
      `Unexpected sidecar left after clean-test: ${path.relative(testDirectory, filePath)}`,
  )
  failWithIssues(issues)
}

function parseMode(): VerifyMode {
  const rawMode = process.argv[2]
  if (rawMode === 'after-test' || rawMode === 'after-clean-test') {
    return rawMode
  }

  console.error('Expected verification mode: after-test or after-clean-test')
  process.exit(1)
}

function run(): void {
  const mode = parseMode()
  const allFiles = getRecursiveFiles(testDirectory)

  if (mode === 'after-test') {
    verifyAfterTest(allFiles)
    return
  }

  verifyAfterCleanTest(allFiles)
}

run()
