import { anotherFile } from './subdir/anotherFile-sidecar'

export const someFile = {
  hello: 'world',
  aThing: anotherFile.something,
}
