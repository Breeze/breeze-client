var fs = require("fs");
var exec = require('child_process').exec;

/** return true if the file contents are different, false otherwise. */
function isDifferent(srcName, destName) {
  if (!fs.existsSync(destName)) return true;

  if (getFileSize(srcName) != getFileSize(destName)) return true;

  var srcBuf = fs.readFileSync(srcName);
  var destBuf = fs.readFileSync(destName);
  if (srcBuf.compare(destBuf) != 0) return true;

  return false;
}

/** return the file size in bytes */
function getFileSize(filename) {
  var stats = fs.statSync(filename);
  var fileSizeInBytes = stats["size"];
  return fileSizeInBytes;
}

/** exec cmd, then call fn if cmd was successful */
function run(cmd, fn) {
  exec(cmd, function (error, stdout, stderr) {
    stdout && console.log('stdout: ' + stdout);
    stderr && console.log('stderr: ' + stderr);
    if (error !== null) {
      console.log('rollup exec error: ' + error);
    } else {
      fn();
    }
  });
}


module.exports = {
  isDifferent: isDifferent,
  getFileSize: getFileSize,
  run: run
}
