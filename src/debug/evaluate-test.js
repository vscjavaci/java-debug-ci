import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
import { assert } from 'chai'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'

describe('Evaluate test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new EvaluateTest();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass evaluate test.', function (done) {
        this.timeout(1000 * 20);
        (async () => {
            try {
                await debugEngine.launch();
                if (config.initialBreakpoints) {
                    for (let breakpoint of config.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, config.sourcePath, breakpoint.relativePath);
                        await debugEngine.setBreakpoints(breakFile, breakpoint.lines);
                    }
                }
                // // starting
                await debugEngine.startDebug();
                const terminateEvent = await debugEngine.waitForTerminate();
                console.log('exiting', terminateEvent);
                await utils.timeout(1000);
                done();
            } catch (error) {
                done(error);
                throw error;
            }
        })();
    });
});

class EvaluateTest {
    get workspaceRoot() {
        return '21.evaluate';
    }

    get sourcePath() {
        return 'src/main/java/evaluate';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "EvaluateTest.java",
            lines: [7, 12]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'EvaluateTest.java');
        const expectedLines = [7, 12];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/EvaluateTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);
            console.log('***threads', await engine.threads());
            let evaluateArguments = [{
                type: "const",
                request: "1+2",
                expectedResponse: 3
            }, {
                type: "variable",
                request: "i+1",
                expectedResponse: 2
            }, {
                type: "notExistVariable",
                request: "a",
                expectedResponse: "a cannot be resolved to a variable"
            }, {
                type: "function",
                request: "test()+10",
                expectedResponse: 13
            }];

            let evaluateTest = async arg => {
                let evaluateResponse;
                try {
                    evaluateResponse = await engine.evaluate(arg.request, detail.id, "watch");
                    if (arg.type !== "notExistVariable") {
                        console.log("******", "Evaluate " + arg.type);
                        assert(evaluateResponse.result.toString() === arg.expectedResponse.toString());
                    }
                }
                catch (ex) {
                    if (arg.type === "notExistVariable") {
                        console.log("******", "Evaluate not exisist variable");
                        assert(ex.message.includes(arg.expectedResponse));
                    }
                }

            };

            for (let ele of evaluateArguments) {
                await evaluateTest(ele);
            }

            await engine.resume(detail.event.body.threadId);
        });
    }
}