<p align="center"><a href="http://www.getbreezenow.com/" target="_blank"><img src="http://breeze.github.io/images/logos/BreezeJsB.png" alt="Breeze" width="100"/></a></p>

# [Breeze](http://breeze.github.io/doc-main/) Data Management for JavaScript Clients  

**Breeze** is a library that helps you manage data in rich client applications. If you store data in a database, query and save those data as complex object graphs, and share these graphs across multiple screens of your JavaScript client, Breeze is for you.

Client-side querying, caching, dynamic object graphs, change tracking and notification, model validation, batch save, offline … all part of rich data management with Breeze.  Breeze clients communicate with any remote service that speaks HTTP and JSON.

**Breeze** lets you develop applications using the same powerful idioms on the client and server. You can

- query with a rich query syntax
- navigate the graph of related entities
- track changes as you add/change/delete entities
- perform client-side validation
- save all changes in a single transaction
- use the same entity model on the server and client

## Install from npm

    npm install breeze-client
or 

    npm install breeze-client@cjs

The version tagged `cjs` uses an older Angular Package Format, and includes ES5 and ES2015 versions, as well as UMD bundles.

The version tagged `latest` (and `mjs`) uses updated [Angular Package Format](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview) and ES2022 .mjs modules.  It has `esm2022` and `fesm2022` folders, but no UMD `bundles` folder.

If you want the latest module format, and don't care about UMD bundles, use `breeze-client`.

If you need UMD bundles, or need backward compatibility with ES5 or ES2015, use `breeze-client@cjs`.

## Documentation 

See the [docs](http://breeze.github.io/doc-js/features.html) for more info about what Breeze does and how to use it.

Set the [release notes](http://breeze.github.io/doc-js/release-notes.html) for changes in the latest version.

## Examples

See some [examples](https://github.com/Breeze/northwind-demo) of how to use breeze with Angular, Aurelia, React, and Vue in the [Northwind-Demo](https://github.com/Breeze/northwind-demo).

See the [TempHire](https://github.com/Breeze/temphire.angular) application for a richer example showing proper architectural patterns.

## Sources

The sources for this package are in the [breeze-client](https://github.com/Breeze/breeze-client) repo.  Please file issues and pull requests against that repo.

## Upgrading Breeze

See the [UPGRADE](https://github.com/Breeze/breeze-client/blob/master/UPGRADE.md) document for information on upgrading from Breeze 1.x to 2.x.

## Building Breeze

See the [BUILD](https://github.com/Breeze/breeze-client/blob/master/BUILD.md) document for instructions on building the Breeze and its API docs.

<hr>

If you have discovered a bug or missing feature, please create an issue in the [breeze-client github repo](https://github.com/Breeze/breeze-client).

If you have questions about using Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
