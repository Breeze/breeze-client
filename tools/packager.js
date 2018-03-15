'use strict';

// Canonical path provides a consistent path (i.e. always forward slashes) across different OSes
const path = require('canonical-path');
const fs = require('fs-extra');

const PROJECT_DIR = path.join(__dirname, '../'); // one up from tools
const DEST = path.join(PROJECT_DIR, 'dist');

const PACKAGE_JSON ='package.json';
const SOURCE_LICENSE = 'LICENSE';

const unwantedFiles = [
  // 'public_api.d.ts', // seem to need it for now
];

copyLicense();
createPackageJson();
removeUnwantedFiles();

function copyLicense() {
  const source = path.join(PROJECT_DIR, SOURCE_LICENSE);
  const output = path.join(DEST, SOURCE_LICENSE);
  fs.copySync(source, output);
}

function createPackageJson() {
  const packageJson = fs.readJsonSync(path.join(PROJECT_DIR, PACKAGE_JSON));

  const { 
    name, version, description, repository, author, contributors, license, bugs, homepage
  } = packageJson;

  const copyProps = {
    name, version, description, repository, author, contributors, license, bugs, homepage
  };

  const outputProperties = {
    "main": "bundles/breeze-client.umd.js",
    "module": "breeze-client.es5.js",
    "es2015": "breeze-client.js",
    "typings": "breeze-client.d.ts",
  }

  const newPackageJson = { ...copyProps, ...outputProperties };
  fs.writeJsonSync(path.join(DEST, PACKAGE_JSON), newPackageJson, { spaces: 2 });
}

function removeUnwantedFiles() {
  unwantedFiles
    .map(file => path.join(DEST, file))
    .forEach(file => fs.remove(file));
}
