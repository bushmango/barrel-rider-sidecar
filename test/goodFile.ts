import { anotherFile } from './subdir/anotherFile-sidecar'

export const someExport = {
  hello: 'world',
  aThing: anotherFile.something,
}

export const doSomething = () => {}
