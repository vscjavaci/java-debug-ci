const execFile = require('child_process').execFile;
const child = execFile('node', (error, stdout, stderr) => {
});
setTimeout(() => {
    child.kill("SIGINT");
}, 100000);
console.log(child.pid);