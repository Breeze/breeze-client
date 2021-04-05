# Building Breeze

## Build using ng-packagr
Run `npm run build`.  This will create files in the '\dist' dir.  The directory structure is the [Angular Package Format](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview).

    adapter-*/                Breeze adapter definitions (*.d.ts) for ajax, data service, model library, and uri builder
    bundles/                  Breeze and adapter libraries in UMD
    esm5/                     Breeze and adapter libraries as ES5 modules (separate source files)
    esm2015/                  Breeze and adapter libraries as ES6 modules (separate source files)
    fesm5/                    Breeze and adapter libraries as ES5 modules (combined source files)
    fesm2015/                 Breeze and adapter libraries as ES6 modules (combined source files)
    spec/                     TypeScript definition files (.d.ts) for tests
    src/                      TypeScript definition files (.d.ts) for source
    breeze-client.d.ts        TypeScript definition file (links to the files in src/) 
    breeze-client.metadata.json      Metadata for Angular AOT
    index.d.ts                Main entry point
    LICENSE                   MIT
    package.json              Package metadata
    public_api.d.ts           Main entry point


It will also create `breeze-client-{version}.tgz` in the main directory.  This file can then be installed in a project using

    npm install ..\{path}\breeze-client-{version}.tgz


## Build API Docs
Run `npm run typedoc`.  This will create a '\docs' dir. click on the 'index.html' in this folder to see the docs.

## Compile Notes
In general we have avoided using null parameters in favor of undefined parameters thoughout the API. This means that signatures will look like

`a(p1: string, p2?: Entity)`

as opposed to 

`a(p1: string, p2?: Entity | null);`

This IS deliberate.  In general, with very few exceptions input parameters will rarely say 'p: x | null'.  The only exceptions are where
we need to be able to pass a null parameter followed by one or more non null params.  This is very rare. SaveEntities(entities: Entity[] | null, ...)
is one exception. 

Note that this is not a breaking change because the underlying code will always check for either a null or undefined. i.e. 'if (p2 == null) {'
so this convention only affects typescript consumers of the api.  Pure javascript users can still pass a null in ( if they want to)

Note that it is still acceptable for api calls to return a null to indicate that nothing was found.  i.e. like getEntityType().  

## Jasmine tests 

The tests are found in the `spec` directory.  There are three ways to run them.

**1) From command line:**

run `npm install jasmine -g` ( global install).

run `npm run test`  from top level breeze-client dir.

**2) From VS code debugger:**

add this section to 'launch.json'
    
    {
        "name": "Debug Jasmine Tests",
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

Run `npm install jasmine` (local install)

Set breakpoint and hit Ctrl-F5.     

**3) From Chrome debugger:**

See [Debugging Node.js with Chrome DevTools](https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27#.pmqejrn8q).

1) Open Chrome and go to `chrome://inspect`

2) Click on the link that says [Open dedicated DevTools for Node]()

3) Put a `debugger;` statement in your code where you want to start debugging

4) Run your Jasmine tests in debug mode

    `npm run debug`

5) Go back to the browser. The `--inspect-brk` (part of the `npm run debug` script) tells the debugger to break on the first line of the first script. You're stopped inside of Jasmine.  Now set your breakpoints, and click the arrow (or hit F8) to continue.

## Legacy Tests

The original [breeze.js](../breeze.js) repo contains thousands of tests, some of which are end-to-end and require a server backend.  The tests are in [breeze.js/test/internal/](../breeze.js/test/internal/), and they expect to find a `breeze.debug.js` file in 
the neighboring directory, breeze.js/test/breeze/.

The `breeze.debug.js` file is a UMD module containing the main breeze-client code and certain adapters.  To build it, run

`npm run copy-to-breezejs`

That will create (or overwrite!) `../breeze.js/test/breeze/breeze.debug.js`.

Then you can launch the server, navigate to the test page, and run the test suite.

<hr>

If you have discover a bug or missing feature, please create an issue in the [breeze-client github repo](https://github.com/Breeze/breeze-client).

If you have questions about using Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
