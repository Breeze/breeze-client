# breeze-client
Breeze data management for JavaScript clients.  
See the [docs](http://breeze.github.io/doc-js/features.html) for more info about what Breeze does and how to use it.

## Install from npm

    npm install breeze-client@next

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

## Breaking Changes
API is almost identical to the original (breezejs 1.x) but small changes are noted below:

 - Breeze no longer depends upon Q.js.  But it does depend on a ES6 promise implementation. i.e. the existence of a global `Promise` object.  The `setQ` function is now a no-op.
 - The names of the enum values no longer have "Symbol" at the end.  E.g. `EntityStateSymbol` is now `EntityState`.
 - The `DataServiceOptions` interface is now `DataServiceConfig` to be consistent with other naming
 - The `initializeAdapterInstances` method is removed; use the singular `config.initializeAdapterInstance` method.

 ### Adapter Changes
 The names of the adapter files have changed.  E.g. `breeze.dataService.webApi` is now `adapter-data-service-webapi`, 
 and the locations have changed due to Angular-compatible bundling.

 Also, the aggressive tree-shaking of tsickle/terser/webpack in Angular 8 removes the functions that the Breeze adapters
 use to register themselves!  So you need to register them yourself.

If you have this:

    import 'breeze-client/breeze.dataService.webApi';
    import 'breeze-client/breeze.modelLibrary.backingStore';
    import 'breeze-client/breeze.uriBuilder.odata';
    import { BreezeBridgeHttpClientModule } from 'breeze-bridge2-angular';

Replace it with this:

    import { config } from 'breeze-client';
    import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
    import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
    import { UriBuilderODataAdapter } from 'breeze-client/adapter-uri-builder-odata';
    import { AjaxHttpClientAdapter } from 'breeze-bridge2-angular';

Note that now you _do not_ import the `BreezeBridgeHttpClientModule`, just the `AjaxHttpClientAdapter`.

Then, in your constructor function (for your module or Entity Manager Provider):

    constructor(http: HttpClient) {
        // the order is important
        ModelLibraryBackingStoreAdapter.register();
        UriBuilderODataAdapter.register();

        config.registerAdapter('ajax', <any>function() { return new AjaxHttpClientAdapter(http); });
        config.initializeAdapterInstance('ajax', AjaxHttpClientAdapter.adapterName, true);

        DataServiceWebApiAdapter.register();
    }

The above has been tested on Angular 7 and 8, and should work for earlier versions.

For apps that use global JavaScript libraries, the UMD versions are still available, under the `bundles` directory:

    <script src="node_modules/breeze-client/bundles/breeze-client.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-model-library-backing-store.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-data-service-webapi.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-ajax-angularjs.umd.js"></script>

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


