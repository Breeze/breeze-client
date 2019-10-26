# Breeze 2.0
Next version of Breeze, built using TypeScript 3.x.

## Breaking changes
API is almost identical to the original (breezejs 1.x) but small changes are noted below:

 - Breeze no longer depends upon Q.js.  But it does depend on a ES6 promise implementation. i.e. the existence of a global `Promise` object.  You will need a polyfill for `Promise` in older browsers.  The `setQ` function is now a no-op.
 - The names of the enum values no longer have "Symbol" at the end.  E.g. `EntityStateSymbol` is now `EntityState`.
 - The `DataServiceOptions` interface is now `DataServiceConfig` to be consistent with other naming
 - The `initializeAdapterInstances` method is removed; use the singular `config.initializeAdapterInstance` method.
