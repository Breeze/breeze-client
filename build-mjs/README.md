# Building Breeze

## build-mjs

This folder builds breeze-client using newer Angular libraries and [ng-packagr](https://github.com/ng-packagr/ng-packagr).  
It's for current browsers and modern JavaScript applications that can use modern ES modules.  
It does not create ES5 modules or UMD bundles; for that you need the ../build-cjs folder.

## Build using ng-packagr
Run `npm run build`.  This will create files in the `..\dist` dir.  The directory structure is the [Angular Package Format](https://angular.dev/tools/libraries/angular-package-format).

    adapter-*/                Breeze adapter definitions (*.d.ts) for ajax, data service, model library, and uri builder
    esm2022/                  Breeze and adapter libraries as ES2022 modules (separate source files)
    fesm2022/                 Breeze and adapter libraries as ES2022 modules (combined source files)
    mixin-*/                  Breeze mixin definitions (*.d.ts) for getEntityGraph, save queuing
    src/                      TypeScript definition files (.d.ts) for source
    index.d.ts                Main entry point (links to files in /src)
    LICENSE                   MIT
    package.json              Package metadata
    README.md                 Readme file

It will also create `breeze-client-{version}.tgz` in this directory.  This file can then be installed in a project using

    npm install ..\{path}\breeze-client-{version}.tgz

The build script installs the built breeze-client into the `..\spec` directory so it can tested.

## Publishing

After building, publish breeze-client to npm using

    npm run publish

This will remove the "private" flag and publish the `../dist` folder to npm with the `latest` and `mjs` tags.

> NOTE: Both build folders (/build-cjs and /build-mjs) put their output in the `../dist` folder.  So you need to build+publish each one before you build the next one; otherwise you'll be publishing the wrong artifacts.
