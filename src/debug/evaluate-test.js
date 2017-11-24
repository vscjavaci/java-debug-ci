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
            lines: [6, 7]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'EvaluateTest.java');
        const expectedLines = [6, 7];
        const outputList = [];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/EvaluateTest.java:*', async (event, arg1, arg2, detail) => {
            const sendEvaluateRequests = {
                notExistVariable: {
                    arg: "a",
                    result: "a cannot be resolved to a variable"
                },
                const: {
                    arg: "1+2",
                    result: 3
                },
                variable: {
                    arg: "i+1",
                }
            };

            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);

            console.log('***threads', await engine.threads());
            try {
                const evaluateNotExistVariable = await engine.evaluate(sendEvaluateRequests["notExistVariable"].arg, detail.id);
            }
            catch (ex) {
                console.log("****", "Evaluate not exist variable");
                assert(ex.message.includes(sendEvaluateRequests["notExistVariable"].result))
            }
            
            console.log("****","Evaluate const ");
            const evaluateConst = await engine.evaluate(sendEvaluateRequests["const"].arg, detail.id);
            assert(evaluateConst.result == sendEvaluateRequests["const"].result);

            console.log("****","Evaluate variable");
            const evaluatei = await engine.evaluate(sendEvaluateRequests["variable"].arg, detail.id);
            const scopes = await engine.scopes(detail.id);
            console.log('***scopes', scopes);
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                for (let variable of variables.variables) {
                    console.log('******', variable);
                    if (variable.variablesReference > 0) {
                        console.log('----->', await engine.variables(variable.variablesReference));
                    }
                    console.log("****", evaluatei);
                    if (variable.name === sendEvaluateRequests["variable"].arg) {
                        assert(evaluate.result === variable.value + 1)
                    }

                }
            }
            await engine.resume(detail.event.body.threadId);
        });
    }
}