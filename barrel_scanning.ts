import * as fs from 'fs'
import * as path from 'path'
import * as parcelWatcher from '@parcel/watcher'
import type { CliOptions } from './barrel_cli'
import { barrel_generator } from './barrel_generator-sidecar'

function isTsOrTsxFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx')
}

function isInsideNodeModules(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  const segments = normalizedPath.split(path.sep)
  return segments.includes('node_modules')
}

function isCopyInProgressFile(filePath: string): boolean {
  return / copy\.[^.]+$/.test(path.basename(filePath))
}

function shouldIgnoreForRebuild(filePath: string): boolean {
  if (
    filePath.endsWith('index.ts') ||
    filePath.endsWith('index.tsx') ||
    isInsideNodeModules(filePath) ||
    isCopyInProgressFile(filePath)
  ) {
    return true
  }

  return false
}

function isOldSidecarFile(filePath: string): boolean {
  return /\.sidecar\.(ts|tsx)$/.test(filePath)
}

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

export function readFileIfPresent(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

function removeGeneratedFile(filePath: string, verbose: boolean): void {
  if (fs.existsSync(filePath)) {
    console.log('removing', filePath)
    fs.unlinkSync(filePath)
    if (verbose) {
      console.log('removed sidecar file:', filePath)
    }
  }
}

export function removeOldSidecars(
  sourceDirectories: string[],
  verbose: boolean,
  removeAll: boolean,
): void {
  console.log('deleting existing index files')

  for (const sourceDirectory of sourceDirectories) {
    const allFiles = getRecursiveFiles(sourceDirectory)
    const generatedFiles = allFiles.filter(
      barrel_generator.isGeneratedSidecarFile,
    )

    for (const generatedFile of generatedFiles) {
      if (!removeAll && !isOldSidecarFile(generatedFile)) {
        continue
      }

      if (!removeAll) {
        const extension = path.extname(generatedFile)
        const originalFilePath =
          generatedFile.substring(
            0,
            generatedFile.length - '-sidecar'.length - extension.length,
          ) + extension

        if (fs.existsSync(originalFilePath)) {
          continue
        }
      }

      removeGeneratedFile(generatedFile, verbose)
    }
  }
}

function rebuildQueuedSidecars(
  queuedPaths: string[],
  verbose: boolean,
  quiet: boolean,
): void {
  let rebuiltCount = 0
  let skippedCount = 0
  const rebuiltPaths: string[] = []

  for (const filePath of queuedPaths) {
    if (verbose) {
      console.log('building barrel index for', filePath)
    }

    const sidecarGeneration = barrel_generator.createSidecarGeneration(
      filePath,
      verbose,
    )
    if (!sidecarGeneration.contents) {
      if (fs.existsSync(sidecarGeneration.sidecarFilename)) {
        fs.unlinkSync(sidecarGeneration.sidecarFilename)
      }
      continue
    }

    const currentSidecarContents = readFileIfPresent(
      sidecarGeneration.sidecarFilename,
    )

    if (currentSidecarContents === sidecarGeneration.contents) {
      skippedCount += 1
      continue
    }

    fs.writeFileSync(
      sidecarGeneration.sidecarFilename,
      sidecarGeneration.contents,
    )
    rebuiltCount += 1
    rebuiltPaths.push(sidecarGeneration.sidecarFilename)
  }

  if (!quiet && rebuiltCount > 0) {
    console.log('barrel-rider rebuilt', rebuiltCount, 'skipped', skippedCount)
    if (rebuiltPaths.length === 1) {
      console.log(`(${rebuiltPaths[0]})`)
    }
  }
}

function debounce(callback: () => void, waitMs: number): () => void {
  let timeout: NodeJS.Timeout | null = null

  return () => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      timeout = null
      callback()
    }, waitMs)
  }
}

function keepProcessAlive(): void {
  console.log('watching')
  setInterval(() => {}, 1 << 30)
}

export function scanAndWatchSources(
  sourceDirectories: string[],
  options: CliOptions,
): void {
  let queuedPaths: string[] = []
  const flushRebuilds = () => {
    rebuildQueuedSidecars(
      queuedPaths,
      Boolean(options.verbose),
      Boolean(options.quiet),
    )
    queuedPaths = []
  }
  const scheduleRebuilds = options.watch
    ? debounce(flushRebuilds, 2000)
    : flushRebuilds

  const queueRebuild = (filePath: string, shouldSchedule: boolean): void => {
    if (options.verbose) {
      console.log('trying path', filePath)
    }

    if (shouldIgnoreForRebuild(filePath)) {
      return
    }

    if (!queuedPaths.includes(filePath)) {
      queuedPaths.push(filePath)
    }

    if (shouldSchedule) {
      scheduleRebuilds()
    }
  }

  if (options.watch) {
    for (const watchedDirectory of sourceDirectories) {
      console.log('watching: ', watchedDirectory)
      const initialFiles =
        getRecursiveFiles(watchedDirectory).filter(isTsOrTsxFile)
      for (const filePath of initialFiles) {
        queueRebuild(filePath, true)
      }
    }

    for (const watchedDirectory of sourceDirectories) {
      parcelWatcher.subscribe(watchedDirectory, (error, events) => {
        if (error) {
          console.error('watch error', error)
          return
        }

        for (const event of events) {
          if (isTsOrTsxFile(event.path) && !isInsideNodeModules(event.path)) {
            queueRebuild(event.path, true)
          }
        }
      })
    }

    keepProcessAlive()
    return
  }

  console.log('scanning')
  for (const sourceDirectory of sourceDirectories) {
    if (isInsideNodeModules(sourceDirectory)) {
      continue
    }

    console.log('scanning', sourceDirectory)
    const files = getRecursiveFiles(sourceDirectory).filter(isTsOrTsxFile)
    for (const filePath of files) {
      queueRebuild(filePath, false)
    }
  }

  flushRebuilds()
}
