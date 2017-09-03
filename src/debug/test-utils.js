import chai from 'chai'
import fs from 'fs-plus'
import path from 'path'
import _ from 'lodash'
import {DebugClient} from 'vscode-debugadapter-testsupport'
import {DebugEngine} from "./debug-engine";
import {startDebugServer} from './debug-proxy'
import {startLS} from './jdt-ls-starter'
import mkdirp from 'mkdirp'

const assert = chai.assert;
const isCaseInsensitive = fs.isCaseInsensitive();

export function pathEquals(file1, file2) {
    if (!isCaseInsensitive) {
        return file1 && file2 && file1.replace(/\\/g, '/') === file2.replace(/\\/g, '/');
    } else {
        return file1 && file2 && file1.replace(/\\/g, '/').toLowerCase() === file2.replace(/\\/g, '/').toLowerCase();
    }
}


export function validateResponse(response) {
    assert(response.success, `bad response: ${JSON.stringify(response, null, 4)}`);
}

export function shouldMatch(str, reg) {
    assert(reg.exec(str), `expected ${reg}, but acutally ${str}`);
}

const compare = (expect, actual) => {
    if (_.isString(expect)) {
        actual.should.equal(expect);
    } else if (expect.exec) {
        shouldMatch(actual, expect);
    }
};

export function compareVariable(expect, actual) {
    if (expect.type) {
        compare(expect.type, actual.type);
    }
    if (expect.value) {
        compare(expect.value, actual.value);
    }
}


export async function createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config) {

    if (!fs.isDirectorySync(DATA_ROOT)) {
        throw new Error(`${DATA_ROOT} doesn't exist.`);
    }
    if (!fs.isDirectorySync(LANGUAGE_SERVER_ROOT)) {
        throw new Error(`${LANGUAGE_SERVER_ROOT} doesn't exist.`);
    }


    const promise1 = startDebugServer(DATA_ROOT);
    mkdirp.sync(LANGUAGE_SERVER_WORKSPACE);
    startLS(LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE);
    const port = parseInt(await promise1);
    await promise1;
    const dc = new DebugClient('java');
    await dc.start(port);
    const engine = new DebugEngine(DATA_ROOT, dc, {
        "cwd": DATA_ROOT,
        "startupClass": config.mainClass,
        "classpath": path.join(DATA_ROOT, config.outputPath),
        "sourcePath": [
            path.join(DATA_ROOT, config.sourcePath)
        ]
    });
    config.withEngine(engine);
    dc.on('terminated', (event) => {
        engine.handleEvent('terminated').then(() => {
            engine.promiseResolve('terminated');
        });
    });
    dc.on('output', event => {
        if (event.body.category === 'stderr' && event.body.output.includes('JDWP Unable to get JNI 1.2 environment')) {
            // ignore because an known jdk issue.
            return;
        }
        engine.handleEvent('output', event.body.category, null, event.body);
    });

    dc.on('stopped', async (event) => {
        const stopped = event.body;
        if (stopped.reason === 'breakpoint') {
            try {
                const stackTraces = (await engine.stackTrace(event.body.threadId)).stackFrames;
                assert(stackTraces.length, 'empty stackTrace is illegal');
                const stackTrace = stackTraces[0];

                await engine.handleEvent('breakpoint',
                    stackTrace.source.path.replace(/\\/g, '/'), stackTrace.line.toString(), {...stackTrace, ...{event: event}});
            } catch (err) {
                console.error(err);
                engine.promiseReject(err);
            }
        }
        //TODO, more handle towards step event
    });
    return engine;
}

export const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};