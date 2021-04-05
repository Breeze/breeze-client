# Upgrade from Breeze 1.x to 2.x

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

    import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
    import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
    import { UriBuilderODataAdapter } from 'breeze-client/adapter-uri-builder-odata';
    import { AjaxHttpClientAdapter } from 'breeze-client/adapter-ajax-httpclient';

Note that now you _do not_ need `breeze-bridge2-angular`, because the AjaxHttpClientAdapter is now part of the breeze-client package.

Then, in your constructor function (for your module or Entity Manager Provider):

    constructor(http: HttpClient) {
        // the order is important
        ModelLibraryBackingStoreAdapter.register();
        UriBuilderODataAdapter.register();
        AjaxHttpClientAdapter.register(http);
        DataServiceWebApiAdapter.register();
    }

The above has been tested on Angular 7 and 8, and should work for earlier versions.

> Note that if you are using Breeze .NET Core on the server, you should use `UriBuilderJsonAdapter` instead of `UriBuilderODataAdapter`.

For apps that use global JavaScript libraries, the UMD versions are still available, under the `bundles` directory:

    <script src="node_modules/breeze-client/bundles/breeze-client.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-model-library-backing-store.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-data-service-webapi.umd.js"></script>
    <script src="node_modules/breeze-client/bundles/breeze-client-adapter-ajax-angularjs.umd.js"></script>

