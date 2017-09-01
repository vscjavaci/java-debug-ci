import chai from 'chai'
import fs from 'fs-plus'
import path from 'path'
import _ from 'lodash'
import {DebugClient} from 'vscode-debugadapter-testsupport'
import {DebugEngine} from "./debug-engine";
import {startDebugServer} from './debug-proxy'
import {startLS} from './jdt-ls-starter'
import mkdirp from 'mkdirp'
import * as utils from './test-utils'
import {Variable} from "./variable";

chai.should();

const assert = chai.assert;
const ROOT = path.normalize(path.join(__dirname, '../../testcase'));
const LANGUAGE_SERVER_ROOT = path.normalize(path.join(__dirname, '../../server'));
const LANGUAGE_SERVER_WORKSPACE = path.normalize(path.join(__dirname, '../../ws'));

describe('HelloWorld test', () => {
    let varibleTest;
    let port;
    let _launchRequest;
    let dc;
    let DATA_ROOT;
    let setBreakpointFunc;
    beforeEach(function() {
        this.timeout(1000 * 20);
        return (async () => {
            varibleTest = new Variable();
            setBreakpointFunc = (dc, file, lines) => {
                return dc.setBreakpointsRequest({
                    lines: lines,
                    breakpoints: _.map(lines, d => {
                        return {line: d}
                    }),
                    source: {path: file}
                });
            };
            DATA_ROOT = path.join(ROOT, varibleTest.workspaceRoot);
            if (!fs.isDirectorySync(DATA_ROOT)) {
                throw new Error(`${DATA_ROOT} doesn't exist.`);
            }
            if (!fs.isDirectorySync(LANGUAGE_SERVER_ROOT)) {
                throw new Error(`${LANGUAGE_SERVER_ROOT} doesn't exist.`);
            }
            const promise1 = startDebugServer(DATA_ROOT);
            mkdirp.sync(LANGUAGE_SERVER_WORKSPACE);
            startLS(LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE);
            port = parseInt(await promise1);
            await promise1;


            _launchRequest = () => {
                return {
                    "cwd": DATA_ROOT,
                    "startupClass": varibleTest.mainClass,
                    "classpath": path.join(DATA_ROOT, varibleTest.outputPath),
                    "sourcePath": [
                        path.join(DATA_ROOT, varibleTest.sourcePath)
                    ]
                };
            };

            dc = new DebugClient('java');
            await dc.start(port);

        })();
    });

    afterEach(async () => {
        const socket = dc._socket;
        socket.end();
        socket.destroy();
    });

    it('should pass Variable test.', function(done) {
        this.timeout(50000);
        (async () => {
            try {
                assert.isOk(varibleTest, 'failed to creawte helloworld test.');
                await dc.launch(_launchRequest());
                console.log('launch success.');

                if (varibleTest.initialBreakpoints) {
                    for (let breakpoint of varibleTest.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, varibleTest.sourcePath, breakpoint.relativePath);
                        const breakpointResponse = await setBreakpointFunc(dc, breakFile, breakpoint.lines);
                        utils.validateResponse(breakpointResponse);
                    }
                }
                // starting
                await dc.configurationDoneRequest();
                let debugEngine = new DebugEngine(DATA_ROOT, dc);
                varibleTest.withEngine(debugEngine);
                dc.on('output', event => {
                    return debugEngine.handleEvent('output', event.body.category, null, event.body).catch(console.log);
                });
                dc.on('stopped', (event) => {
                    const stopped = event.body;
                    if (stopped.reason === 'breakpoint') {
                        dc.stackTraceRequest({
                            threadId: event.body.threadId
                        }).then(stackTracesResponse => {
                            utils.validateResponse(stackTracesResponse);
                            const stackTrace = stackTracesResponse.body.stackFrames[0];
                            return debugEngine.handleEvent('breakpoint', stackTrace.source.path.replace(/\\/g, '/'), stackTrace.line.toString(), {...stackTrace, ...{event: event}}).catch(console.log);
                        });
                    }
                    //TODO, more handle towards step event
                });

                dc.on('terminated', (event) => {
                    debugEngine.handleEvent('terminated');
                });

                const event = await dc.waitForEvent('terminated');
                console.log('exiting', event);
                done();
            } catch (error) {
                done(error);
                throw error;
            }
        })();
    });
});