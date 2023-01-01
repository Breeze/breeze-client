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
      console.log('run exec error: ' + error);
    } else {
      fn();
    }
  });
}

/** replace a string in a file */
function replaceInFile(filename, search, replace) {
    fs.readFile(filename, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        var result = data.replace(search, replace);
        if (result === data) {
            console.log("replaceInFile: no change to file " + filename);
            return;
        }

        fs.writeFile(filename, result, 'utf8', function (err) {
            if (err) return console.log(err);
        });
        console.log("replaceInFile: changed file " + filename);
    });
}

/** remove the first line of a file */
function removeFirstLine(filename) {
  fs.readFile(filename, 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    var result = data.split("\n").slice(1).join("\n");
    fs.writeFile(filename, result, 'utf8', function (err) {
        if (err) return console.log(err);
    });
    console.log("removeFirstLine: changed file " + filename);
  });
}

/** Get single command line argument, and show usage method if its incorrect */
function getArg() {
  var args = process.argv.slice(2);
  if (args.length !== 1 || args[0].indexOf('.js') >= 0) {
    var msg = "Usage: " + process.argv[0] + " " + process.argv[1] + " [filenameRoot]"
    throw new Error(msg);
  }
  return args[0];
}

module.exports = {
  isDifferent: isDifferent,
  getFileSize: getFileSize,
  run: run,
  replaceInFile: replaceInFile,
  removeFirstLine: removeFirstLine,
  getArg: getArg
}
