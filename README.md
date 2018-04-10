# breeze-client
Breeze for JavaScript clients

## Build using TypeScript-Library-Bundler and Rollup
Run `npm run build`.  This will create files in the '\dist' dir.

    adapters/                 Breeze adapters (in UMD) for ajax, data service, model library, and uri builder
    bundles/                  Main Breeze module in UMD
    src/                      TypeScript definition files (.d.ts)
    breeze-client.d.ts        TypeScript definition file (links to the files in src/) 
    breeze-client.es5.js      Breeze compiled to ES5 (backward-compatible JavaScript)
    breeze-client.es5.js.map  Map from ES5 to source
    breeze-client.js          Breeze compiled to ES2015
    breeze-client.js.map      Map from ES2015 to source
    index.d.ts                Main entry point
    LICENSE                   MIT
    package.json              Package metadata
    public_api.d.ts           Main entry point

It will also create `breeze-client-{version}.tgz` in the main directory.  This file can then be installed in a project using

    npm install ..\{path}\breeze-client-{version}.tgz


## Build API Docs
Run `npm run typedoc`.  This will create a '\docs' dir. click on the 'index.html' in this folder to see the docs.

## Breaking changes
Api is almost identical to the original but small changes are noted below:

 - Breeze no longer depends upon Q.js.  But it does depend on a ES6 promise implementation. i.e. the existence of a global `Promise` object.  The `setQ` function is now a no-op.
 - The names of the adapter files have changed.  E.g. `breeze.dataService.webApi` is now `adapter-data-service-webapi.umd`.
 - The names of the enum values no longer have "Symbol" at the end.  E.g. `EntityStateSymbol` is now `EntityState`.

## Compile Notes
In general we have avoided using null parameters in favor of undefined parameters thoughout the API. This means that signatures will look like

a(p1: string, p2?: Entity)

as opposed to 

a(p1: string, p2?: Entity | null);

This IS deliberate.  In general, with very few exceptions input parameters will rarely say 'p: x | null'.  The only exceptions are where
we need to be able to pass a null parameter followed by one or more non null params.  This is very rare. SaveEntities(entities: Entity[] | null, ...)
is one exception. 

Note that this is not a breaking change because the underlying code will always check for either a null or undefined. i.e. 'if (p2 == null) {'
so this convention only affects typescript consumers of the api.  Pure javascript users can still pass a null in ( if they want to)

Note that it is still acceptable for api calls to return a null to indicate that nothing was found.  i.e. like getEntityType().  

## Jasmine tests 

1) from command line
    run 'npm install jasmine -g' ( global install).
    run 'jasmine'  from top level breeze-next dir.

2) from vs code debugger
    add this section to 'launch.json'
     
        {
            "name": "Debug Jasime Tests",
            "type": "node",
            "request": "launch",
            "program": "${workspaceRoot}/node_modules/jasmine/bin/jasmine.js",
            "stopOnEntry": false,
            "args": [
               
            ],
            "cwd": "${workspaceRoot}",
            "sourceMaps": true,
            "outDir": "${workspaceRoot}/dist"
        }    

    run 'npm install jasmine' // local install   
    set breakpoint and hit Ctrl-F5.     


