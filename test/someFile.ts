import { anotherFile } from './subdir/anotherFile-sidecar'

export const someFile2 = {
  hello: 'world',
  aThing: anotherFile.something,
}

export const another = 'another'
