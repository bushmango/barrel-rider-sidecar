import { anotherFile } from './subdir/anotherFile-sidecar'

const namedExport = {
  hello: 'world',
  aThing: anotherFile.something,
}

export { namedExport }
