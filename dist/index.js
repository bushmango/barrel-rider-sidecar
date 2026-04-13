#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");
const parcelWatcher = require("@parcel/watcher");
const fs = require("fs");
const l = require("lodash");
const path = require("path");
const util_1 = require("util");
const unlinkAsync = util_1.promisify(fs.unlink);
const version = '1.5';
console.log('The Barrel-Rider Sidecar Edition -- Create Typescript Index Files');
console.log(version);
const cwd = process.cwd();
console.log('in ' + cwd);
// https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
const sections = [
    {
        header: 'The Barrel-Rider Sidecar Edition',
        content: 'Creates Typescript index files',
    },
    {
        header: 'Options',
        optionList: [
            {
                name: 'src',
                typeLabel: '{underline directories}',
                description: 'The directories to scan (globs).',
            },
            {
                name: 'watch',
                typeLabel: '{underline Boolean}',
                description: 'Keep this process open and rebuild files when they change.',
            },
            {
                name: 'verbose',
                typeLabel: '{underline Boolean}',
                description: 'Show extra debug info.',
            },
            {
                name: 'quiet',
                typeLabel: '{underline Boolean}',
                description: 'Hide extra logging.',
            },
            {
                name: 'help',
                description: 'Print this usage guide.',
            },
            {
                name: 'remove',
                description: 'Remove old sidecar files.',
            },
        ],
    },
];
// import { promisify } from 'util'
// const readFileAsync = promisify(fs.readFile)
// const writeFileAsync = promisify(fs.writeFile)
async function removeIndexFile(_path) {
    let skip = false;
    if (fs.existsSync(_path)) {
        let cur = fs.readFileSync(_path, 'utf8');
        if (cur.startsWith('// barrel-rider:ignore')) {
            skip = true;
        }
    }
    if (!skip) {
        console.log('removing', _path);
        await unlinkAsync(_path);
    }
}
function getRecursiveFiles(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }
    const files = [];
    const pending = [rootDir];
    while (pending.length > 0) {
        const current = pending.pop();
        if (!current) {
            continue;
        }
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch (_a) {
            continue;
        }
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules') {
                    continue;
                }
                pending.push(fullPath);
            }
            else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
function isTsOrTsxFile(filePath) {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}
function isInsideNodeModules(filePath) {
    const normalizedPath = path.normalize(filePath);
    const segments = normalizedPath.split(path.sep);
    return segments.includes('node_modules');
}
async function run() {
    const optionDefinitions = [
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
        { name: 'port', alias: 'p', type: Number },
        { name: 'remove', alias: 'r', type: Boolean },
    ];
    const options = commandLineArgs(optionDefinitions);
    let valid = options.help || (options.src && options.src.length);
    if (!valid || options.help) {
        // console.log('!! invalid options !!')
        const usage = commandLineUsage(sections);
        console.log(usage);
        return;
    }
    l.defaults(options, { extension: 'ts' });
    if (options.verbose) {
        console.log('verbose mode');
        console.log('cwd:', cwd);
        console.log('options:', JSON.stringify(options, null, 2));
    }
    if (options.remove) {
        // Delete existing index.ts files
        console.log('deleting existing index files');
        for (let i = 0; i < options.src.length; i++) {
            const src = options.src[i];
            const srcPath = path.join(cwd, src);
            let files = getRecursiveFiles(srcPath).filter((f) => /-sidecar\.(ts|tsx)$/.test(f));
            for (let f of files) {
                let ext = path.extname(f);
                let testFile = f.substring(0, f.length - '-sidecar'.length - ext.length) + ext;
                if (!fs.existsSync(testFile)) {
                    await removeIndexFile(f);
                    if (options.verbose) {
                        console.log('removed sidecar file:', f);
                    }
                }
            }
            files = getRecursiveFiles(srcPath).filter((f) => /\.sidecar\.(ts|tsx)$/.test(f));
            for (let f of files) {
                await removeIndexFile(f);
                if (options.verbose) {
                    console.log('removed sidecar file:', f);
                }
            }
        }
    }
    let indexesToRebuild = [];
    function rebuildIndex(_path, shouldSchedule = true) {
        if (options.verbose) {
            console.log('trying path', _path);
        }
        if (_path.endsWith('index.ts') ||
            _path.endsWith('index.tsx') ||
            isInsideNodeModules(_path) ||
            _path.includes(' copy') // Renaming file, don't make an index for this
        ) {
            return; // This shouldn't trigger rebuilding of indexes
        }
        if (!l.includes(indexesToRebuild, _path)) {
            indexesToRebuild.push(_path);
        }
        if (shouldSchedule) {
            scheduleRebuildIndexes();
        }
    }
    function rebuildIndexes() {
        // console.log('should build index', indexesToRebuild)
        let rebuiltCount = 0;
        let skippedCount = 0;
        let rebuiltPaths = [];
        l.forEach(indexesToRebuild, (_path) => {
            if (options.verbose) {
                console.log('building barrel index for', _path);
            }
            let lines = [];
            lines.push('/* eslint-disable */');
            lines.push('/* tslint:disable */');
            lines.push('// THIS FILE IS AuTo-GeNeRaTeD BY barrel-rider-sidecar. DO NOT EDIT');
            lines.push('// see: https://www.npmjs.com/package/barrel-rider-sidecar');
            // lines.push('export const noop = () => {}') // Always export something
            let f = _path;
            let _toDelete = false;
            let skip = false;
            if (f.endsWith('-sidecar.ts') || f.endsWith('.sidecar.tsx')) {
                // Don't scan indexes
                _toDelete = true;
            }
            if (f.endsWith('.d.ts')) {
                // Skip d.ts files
                _toDelete = true;
            }
            if (f.indexOf('.spec.') !== -1 ||
                f.indexOf('.test.') !== -1 ||
                f.indexOf('.e2e.') !== -1) {
                // Test files
                _toDelete = true;
            }
            let ext = path.extname(_path);
            let pathWithoutExt = _path.slice(0, _path.length - ext.length);
            let sidecarFilename = pathWithoutExt + '-sidecar.' + options.extension;
            if (!_toDelete) {
                let basename = path.basename(f);
                let last = basename.lastIndexOf('.');
                let filename = basename.substring(0, last);
                let exportAs = filename.replace(/\./, '_');
                if (doesFileHaveNamedExport(f, exportAs)) {
                    // Named exports
                    _toDelete = true;
                    // lines.push(`export * from './${filename}'`)
                }
                else {
                    // Group and re-export
                    lines.push(`import * as ${exportAs} from './${filename}'`);
                    lines.push(`export { ${exportAs} }`);
                }
                // Write the file
                if (!_toDelete) {
                    let newFileContents = lines.join('\n');
                    if (fs.existsSync(sidecarFilename)) {
                        let cur = fs.readFileSync(sidecarFilename, 'utf8');
                        if (cur.startsWith('// barrel-rider:ignore')) {
                            skip = true;
                        }
                        if (cur.startsWith('// sidecar:ignore')) {
                            skip = true;
                        }
                        if (cur === newFileContents) {
                            skip = true;
                            skippedCount++;
                        }
                    }
                    if (!skip) {
                        rebuiltCount++;
                        fs.writeFileSync(sidecarFilename, newFileContents);
                        rebuiltPaths.push(sidecarFilename);
                    }
                }
            }
            if (_toDelete) {
                if (fs.existsSync(sidecarFilename)) {
                    fs.unlinkSync(sidecarFilename);
                }
            }
        });
        if (!options.quiet) {
            if (rebuiltCount) {
                console.log('barrel-rider rebuilt', rebuiltCount, 'skipped', skippedCount);
                if (rebuiltPaths.length === 1) {
                    console.log(`(${rebuiltPaths[0]})`);
                }
            }
        }
        indexesToRebuild = []; // Reset
    }
    const scheduleRebuildIndexes = options.watch
        ? l.debounce(rebuildIndexes, 2000)
        : rebuildIndexes;
    function doesFileHaveNamedExport(_path, filename) {
        if (filename.indexOf('index') !== -1) {
            return false;
        }
        let regex = new RegExp(`\\s*export\\s+(async\\s+)?(const|function|interface|type|class)\\s+(${escapeRegExp(filename)})(\\s|\\()`);
        // console.log(regex)
        let regex2 = new RegExp(`\\s*export\\s+{.*(\\s+|\\,)(${escapeRegExp(filename)})(\\s+|\\,|\\})`);
        let f = fs.readFileSync(_path, { encoding: 'utf8' });
        return regex.test(f) || regex2.test(f);
    }
    const watchDirectories = [];
    const watchedSourceDirectories = [];
    l.forEach(options.src, (c) => {
        const watchDirectory = path.join(cwd, c);
        watchedSourceDirectories.push(watchDirectory);
        if (options.watch) {
            watchDirectories.push(watchDirectory);
            console.log('watching: ', watchDirectory);
        }
        else {
            if (options.verbose) {
                console.log('scanning: ', watchDirectory);
            }
        }
    });
    if (options.watch) {
        for (const watchDirectory of watchedSourceDirectories) {
            const initialFiles = getRecursiveFiles(watchDirectory).filter(isTsOrTsxFile);
            for (const filePath of initialFiles) {
                rebuildIndex(filePath);
            }
        }
        for (const watchDirectory of watchDirectories) {
            parcelWatcher.subscribe(watchDirectory, (err, events) => {
                if (err) {
                    console.error('watch error', err);
                    return;
                }
                for (const event of events) {
                    if (isTsOrTsxFile(event.path) &&
                        !isInsideNodeModules(event.path)) {
                        rebuildIndex(event.path);
                    }
                }
            });
        }
    }
    else {
        console.log('scanning');
        for (const sourceDirectory of watchedSourceDirectories) {
            console.log('scanning', sourceDirectory);
            const files = getRecursiveFiles(sourceDirectory).filter(isTsOrTsxFile);
            for (const filePath of files) {
                rebuildIndex(filePath, false);
            }
        }
        rebuildIndexes();
    }
    function _watch() {
        console.log('watching');
        // Keep alive
        setInterval(() => { }, 1 << 30);
        // if (process.stdin.isTTY) {
        //   console.log('Press any key to exit')
        //   process.stdin.setRawMode(true)
        //   process.stdin.resume()
        //   process.stdin.on('data', process.exit.bind(process, 0))
        // }
    }
    if (options.watch) {
        _watch();
    }
}
run();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxxREFBb0Q7QUFDcEQsdURBQXNEO0FBQ3RELGlEQUFnRDtBQUNoRCx5QkFBd0I7QUFDeEIsNEJBQTJCO0FBQzNCLDZCQUE0QjtBQUM1QiwrQkFBZ0M7QUFFaEMsTUFBTSxXQUFXLEdBQUcsZ0JBQVMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUE7QUFFeEMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQ3JCLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUVBQW1FLENBQUMsQ0FBQTtBQUNoRixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFBO0FBRXBCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUV4Qix3RkFBd0Y7QUFDeEYsU0FBUyxZQUFZLENBQUMsTUFBTTtJQUMxQixPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsTUFBTSxDQUFDLENBQUEsQ0FBQyxvQ0FBb0M7QUFDM0YsQ0FBQztBQUVELE1BQU0sUUFBUSxHQUFHO0lBQ2Y7UUFDRSxNQUFNLEVBQUUsa0NBQWtDO1FBQzFDLE9BQU8sRUFBRSxnQ0FBZ0M7S0FDMUM7SUFDRDtRQUNFLE1BQU0sRUFBRSxTQUFTO1FBQ2pCLFVBQVUsRUFBRTtZQUNWO2dCQUNFLElBQUksRUFBRSxLQUFLO2dCQUNYLFNBQVMsRUFBRSx5QkFBeUI7Z0JBQ3BDLFdBQVcsRUFBRSxrQ0FBa0M7YUFDaEQ7WUFDRDtnQkFDRSxJQUFJLEVBQUUsT0FBTztnQkFDYixTQUFTLEVBQUUscUJBQXFCO2dCQUNoQyxXQUFXLEVBQ1QsNERBQTREO2FBQy9EO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsU0FBUyxFQUFFLHFCQUFx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