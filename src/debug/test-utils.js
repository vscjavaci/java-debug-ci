import chai from 'chai'
import fs from 'fs-plus'
import path from 'path'
import _ from 'lodash'
import { DebugClient } from 'vscode-debugadapter-testsupport'
import { DebugEngine } from "./debug-engine";
import { startDebugServer, stopDebugServer } from './debug-proxy'
import { startLS, isLanguageServerStarted, killLanguageServer } from './jdt-ls-starter'
import mkdirp from 'mkdirp'
var rimraf = require('rimraf');

const assert = chai.assert;
const isCaseInsensitive = fs.isCaseInsensitive();

export function pathEquals(file1, file2) {
    if (!isCaseInsensitive) {
        return file1 && file2 && file1.replace(/\\/g, '/') === file2.replace(/\\/g, '/');
    } else {
        return file1 && file2 && file1.replace(/\\/g, '/').toLowerCase() === file2.replace(/\\/g, '/').toLowerCase();
    }
}
export function wildcardToRegex(glob) {
    const specialChars = "\\^$*+?.()|{}[]";
    let regexChars = ["^"];
    for (let i = 0; i < glob.length; ++i) {
        const c = glob.charAt(i);
        switch (c) {
            case '?':
                regexChars.push(".");
                break;
            case '*':
                regexChars.push(".*");
                break;
            default:
                if (specialChars.indexOf(c) >= 0) {
                    regexChars.push("\\");
                }
                regexChars.push(c);
        }
    }
    regexChars.push("$");
    return new RegExp(regexChars.join(""));
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
    let defaultSettings = {
        "logLevel": "INFO",
        "maxStringLength": 0,
        "showStaticVariables": true,
        "showQualifiedNames": false,
        "showHex": false
    };
    const promise1 = startDebugServer(DATA_ROOT, config.userSettings || defaultSettings, config);
    mkdirp.sync(LANGUAGE_SERVER_WORKSPACE);
    if (isLanguageServerStarted()) {
        console.log('waiting for ls down.');
        await killLanguageServer();
        await timeout(1000);
    }
    try {
        rimraf.sync(LANGUAGE_SERVER_WORKSPACE);
    } catch (e) {
        throw new Error(`Can't delete ${LANGUAGE_SERVER_WORKSPACE} folder`);
    }
    startLS(LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE);
    let resolveData = await promise1;
    //console.log("###MainClassData-->", resolveData);
    if(config.testName === "multi-root"){
        Object.defineProperty(config,'data',{
            value:resolveData[0],
            writable:false
        })
    }
    const port = parseInt(config.projectName ? resolveData[2] : resolveData[1]);
    await promise1;
    const dc = new DebugClient('java');
    await dc.start(port);
    const engine = new DebugEngine(DATA_ROOT, dc, {
        "cwd": DATA_ROOT,
        "mainClass": config.mainClass,
        "projectName": config.projectName || config.workspaceRoot,
        "classPaths": _.map(_.compact([...(config.classPath || []), config.outputPath]), d => path.resolve(DATA_ROOT, d)),
        "sourcePaths": _.map(_.compact([config.sourcePath, config.testPath]), folder =>
            path.join(DATA_ROOT, folder)),
        "port": config.port,
        "host": config.hostName,
        "args": config.args,
        "vmArgs": config.vmArgs,
        "encoding": config.encoding,
        "console": config.console,
        "stopOnEntry": config.stopOnEntry,
        "stepFilters": config.stepFilters
    });
    config.withEngine(engine);
    dc.on('terminated', (event) => {
        engine.handleEvent('terminated').then(() => {
            engine.promiseResolve('terminated');
            stopDebugServer();
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
        if (stopped.reason === 'breakpoint' || stopped.reason === 'step' || stopped.reason === 'entry') {
            try {
                const stackTraces = (await engine.stackTrace(event.body.threadId)).stackFrames;
                assert(stackTraces.length, 'empty stackTrace is illegal');
                const stackTrace = stackTraces[0];

                await engine.handleEvent(stopped.reason,
                    stackTrace.source.path ? stackTrace.source.path.replace(/\\/g, '/') : stackTrace.source.name,
                    stackTrace.line.toString(), { ...stackTrace, ...{ event: event } });
            } catch (err) {
                console.error(err);
                engine.promiseReject(err);
            }
        } else {
            throw stopped
        }

        //TODO, more handle towards step event
    });
    return engine;
}
export function equalsWithoutLineEnding(a, b) {
    console.log("should be equal", a.replace(/\r/g, ''), b.replace(/\r/g, ''));
    assert.equal(a.replace(/\r/g, ''), b.replace(/\r/g, ''), "should be equal");
}
export const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};