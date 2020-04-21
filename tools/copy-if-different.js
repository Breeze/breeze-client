/** 
 * Copy file/dirctory but only if content is different
 */
var fs = require("fs-extra");

var args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " [src] [dest]\n" + 
  "Copies src (file or directory) to dest, if content of src is different from dest.");
  return;
}

var srcName = args[0];
var destName = args[1];

if (!fs.existsSync(srcName)) {
  console.error("Source file '" + srcName + "' does not exist.");
  return;
}
var srcLen = srcName.length;

fs.copySync(srcName, destName, { filter: filter });
return;

// return true if file should be copied, false otherwise
function filter(src) {
  var stats = fs.statSync(src);
  if (!stats.isFile()) return true;
  var dest = destName + src.substring(srcLen);
  return isDifferent(src, dest);
}

/** return true if the file contents are different, false otherwise. */
function isDifferent(srcName, destName) {
  if (!fs.existsSync(destName)) return true;

  if (getFileSize(srcName) != getFileSize(destName)) return true;

  var srcBuf = fs.readFileSync(srcName);
  var destBuf = fs.readFileSync(destName);
  if (srcBuf.compare(destBuf) != 0) return true;

  return false;
}

