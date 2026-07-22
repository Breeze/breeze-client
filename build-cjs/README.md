# Building Breeze

## build-cjs

This folder builds breeze-client using older Angular libraries and an older version of [ng-packagr](https://github.com/ng-packagr/ng-packagr).  
It's for backward compatibility with older browsers and JavaScript applications that need ES5 module style or CommonJS bundles.
It is built with Angular 9.x because that is the last Angular version that builds ES5 and UMD.

## Build using ng-packagr
Run `npm run build`.  This will create files in the `..\dist` dir.  The directory structure is the [Angular Package Format v12](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview).

    adapter-*/                Breeze adapter definitions (*.d.ts) for ajax, data service, model library, and uri builder
    bundles/                  Breeze and adapter libraries in [UMD](https://github.com/umdjs/umd)
    esm5/                     Breeze and adapter libraries as ES5 modules (separate source files)
    esm2015/                  Breeze and adapter libraries as ES6 modules (separate source files)
    fesm5/                    Breeze and adapter libraries as ES5 modules (combined source files)
    fesm2015/                 Breeze and adapter libraries as ES6 modules (combined source files)
    mixin-*/                  Breeze mixin definitions (*.d.ts) for getEntityGraph, save queuing
    src/                      TypeScript definition files (.d.ts) for source
    breeze-client.d.ts        TypeScript definition file (links to the files in src/) 
    breeze-client.metadata.json      Metadata for Angular AOT
    index.d.ts                Main entry point
    LICENSE                   MIT
    package.json              Package metadata
    README.md                 Readme file

It will also create `breeze-client-{version}.tgz` in this directory.  This file can then be installed in a project using

    npm install ..\{path}\breeze-client-{version}.tgz

The build script installs the newly-built breeze-client into the `..\spec` directory so it can tested.

## Publishing

After building, publish breeze-client to npm using

    npm run publish

This will remove the "private" flag and publish the `../dist` folder to npm with the `cjs` and `umd` tags.

> NOTE: Both build folders (/build-cjs and /build-mjs) put their output in the `../dist` folder.  So you need to build+publish each one before you build the next one; otherwise you'll be publishing the wrong artifacts.
