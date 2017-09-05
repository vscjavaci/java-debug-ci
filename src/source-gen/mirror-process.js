import cp from 'child_process'
let child;
export function start() {
    child = cp.spawn('node');
}

export function getPid() {
    return child ? child.pid: -1;
}

export function stop() {
    if (child) {
        child.kill("SIGINT");
        child = null;
    }
}