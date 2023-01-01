/*
Remove the first line of files that get a duplicate module definition 
due to a bug in the downlevel-dts toolchain
*/
const removeFirstLine = require("./build-util").removeFirstLine;

var files = [
  "dist/adapter-ajax-angularjs/index.d.ts",
  "dist/adapter-ajax-fetch/index.d.ts",
  "dist/adapter-ajax-httpclient/index.d.ts",
  "dist/adapter-ajax-jquery/index.d.ts",
  "dist/adapter-ajax-post/index.d.ts",
  "dist/adapter-data-service-odata/index.d.ts",
  "dist/adapter-data-service-webapi/index.d.ts",
  "dist/adapter-model-library-backing-store/index.d.ts",
  "dist/adapter-model-library-ko/index.d.ts",
  "dist/adapter-uri-builder-json/index.d.ts",
  "dist/adapter-uri-builder-odata/index.d.ts",
  "dist/mixin-get-entity-graph/index.d.ts",
  "dist/mixin-save-queuing/index.d.ts",
]

files.forEach(f => removeFirstLine(f));
