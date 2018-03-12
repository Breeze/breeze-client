const path = require('path');
const dtsBuilder = require('dts-builder');

const projectRoot = path.resolve(__dirname, '..');

dtsBuilder.generateBundles([
  {
    name: 'breeze',
    sourceDir: `${projectRoot}/temp/src`,
    destDir: `${projectRoot}/build`
    // externals: [
    //   `${projectRoot}/src/ext/external-lib.d.ts`,
    //   `${projectRoot}/src/lib/types.d.ts`
    // ]
  }
]);