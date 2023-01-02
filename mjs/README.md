# Readme - mjs

This folder is for building the `mjs` tagged package.  It uses the latest (v15 as of this writing) version of [ng-packagr](https://github.com/ng-packagr/ng-packagr) to build the npm package.  

The root directory uses v9 of ng-packagr to maintain backward compatibility with older projects that depend on older ES versions
and/or UMD modules.

## Building

Running

    npm run build
    npm run publish

will build and then publish breeze-client in npm.  When run from the mjs folder, it will publish it with version **{2.x.y}-mjs**, where {2.x.y} is the version from the root package.json file.  It will publish it with the **mjs** tag, while the root directory publishes the **latest** tag.

See the [npm versions page](https://www.npmjs.com/package/breeze-client?activeTab=versions) for the current tagged versions.
