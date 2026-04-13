import commandLineArgs = require('command-line-args')
import commandLineUsage = require('command-line-usage')
import * as fs from 'fs'
import * as path from 'path'

const cwd = process.cwd()

export type CliOptions = {
  help?: boolean
  quiet?: boolean
  remove?: boolean
  removeOnly?: boolean
  src?: string[]
  verbose?: boolean
  watch?: boolean
  isValid: boolean
  cwd: string
}

type OptionDefinition = {
  alias?: string
  defaultOption?: boolean
  multiple?: boolean
  name: string
  type?: BooleanConstructor | NumberConstructor | StringConstructor
}

const usageSections = [
  {
    header: 'The Barrel-Rider Sidecar Edition',
    content: 'Creates Typescript sidecar files.',
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'src',
        typeLabel: '{underline directories}',
        description: 'The directories to scan.',
      },
      {
        name: 'watch',
        typeLabel: '{underline Boolean}',
        description:
          'Keep this process open and rebuild files when they change.',
      },
      {
        name: 'verbose',
        typeLabel: '{underline Boolean}',
        description: 'Show extra debug info.',
      },
      {
        name: 'quiet',
        typeLabel: '{underline Boolean}',
        description: 'Hide rebuild logging.',
      },
      {
        name: 'help',
        description: 'Print this usage guide.',
      },
      {
        name: 'remove',
        description: 'Remove old sidecar files before scanning.',
      },
      {
        name: 'removeOnly',
        description: 'Remove sidecar files and exit without scanning.',
      },
    ],
  },
]

export function readPackageVersion(): string {
  const packageJsonPath = path.resolve(__dirname, 'package.json')
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export function logBanner(): void {
  console.log(
    'The Barrel-Rider Sidecar Edition -- Create Typescript Index Files',
  )
  console.log('version ' + readPackageVersion())
  console.log(`in ${cwd}`)
}

export function parseOptions(): CliOptions {
  const optionDefinitions: OptionDefinition[] = [
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'verbose', alias: 'v', type: Boolean },
    {
      name: 'src',
      alias: 's',
      type: String,
      multiple: true,
      defaultOption: true,
    },
    { name: 'watch', alias: 'w', type: Boolean },
    { name: 'quiet', alias: 'q', type: Boolean },
    { name: 'remove', alias: 'r', type: Boolean },
    { name: 'removeOnly', type: Boolean },
  ]

  const options: CliOptions = commandLineArgs(optionDefinitions) as CliOptions
  options.cwd = cwd

  const hasSources = Array.isArray(options.src) && options.src.length > 0
  options.isValid = hasSources
  if (options.help || !options.isValid) {
    printUsage()
  }

  // Print out our selected options
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue
    }
    console.log(`option ${key}:`, value)
  }

  return options
}

export function printUsage(): void {
  console.log(commandLineUsage(usageSections))
}
