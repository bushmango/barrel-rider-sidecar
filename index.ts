#!/usr/bin/env node
import * as path from 'path'
import { barrel_cli } from './barrel_cli-sidecar'
import { barrel_scanning } from './barrel_scanning-sidecar'

function run(): void {
  barrel_cli.logBanner()
  const options = barrel_cli.parseOptions()
  if (!options.isValid) {
    return
  }

  const watchedSourceDirectories = (options.src ?? []).map((sourceDirectory) =>
    path.join(options.cwd, sourceDirectory),
  )

  if (options.remove || options.removeOnly) {
    barrel_scanning.removeOldSidecars(
      watchedSourceDirectories,
      Boolean(options.verbose),
      Boolean(options.removeOnly),
    )
  }

  if (options.removeOnly) {
    console.log('removeOnly flag specified, exiting after cleanup')
    return
  }

  barrel_scanning.scanAndWatchSources(watchedSourceDirectories, options)
}

run()
