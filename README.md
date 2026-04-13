# barrel-rider-sidecar

Create Index Files for Typescript

(This helps ensure that input names are consistent and makes it so you don't have to manually create barrel files or named export objects. This makes classless and functional programming smoother.)

Based roughly on https://github.com/sw-yx/barrelbot

## Usage

Run against a source directory:

```bash
yarn start --src src
```

Watch mode:

```bash
yarn start --watch --src src
```

Multiple source roots are supported:

```bash
yarn start --src src tools
```

View all available options:

```bash
yarn start --help
```

## Behavior

- Scans `.ts` and `.tsx` files and writes sibling `-sidecar.ts` files
- Skips `index.*`, `.d.ts`, test files, files inside `node_modules`, and temporary `" copy"` files
- Removes stale generated sidecars when `--remove` is provided
- Removes sidecar files and exits without scanning when `--removeOnly` is provided
- Leaves files alone when they begin with `// barrel-rider:ignore` or `// sidecar:ignore`

## Testing

Testing is manual, and also serves as examples of when the sidecar files are generated.

Run the normal manual test flow with:

```bash
yarn test
```

This generates sidecar files in the `test` directory and then verifies:

- every source file without `ignoreMe` in its name has a matching `-sidecar.ts`
- every source file with `ignoreMe` in its name does not have a matching `-sidecar.ts`

Reset the test environment and exercise the --removeOnly cleanup flow with:

```bash
yarn clean-test
```

This removes sidecar files from the `test` directory and then verifies that no generated `-sidecar` files remain.

## VS Code

You may want to hide generated sidecar files in your IDE. For VSCode:

```json
"files.exclude": {
  "**/*-sidecar.ts": true
}
```
