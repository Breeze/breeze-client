// Remove extra stuff from package.json before publishing,
// and copy it to the build directory.
// Also copies LICENSE and README to build directory
var fs = require("fs-extra");

let rawdata = fs.readFileSync('package.json');  
let pkg = JSON.parse(rawdata);

delete pkg.scripts;
delete pkg.devDependencies;

let json = JSON.stringify(pkg, null, 2);
fs.writeFileSync('build/package.json', json);

fs.copySync('LICENSE', 'build/LICENSE');
fs.copySync('README.md', 'build/README.md');
