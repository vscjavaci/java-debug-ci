import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
const ROOT = path.normalize(path.join(__dirname, '../../testcase'));
const LANGUAGE_SERVER_ROOT = path.normalize(path.join(__dirname, '../../server'));
const LANGUAGE_SERVER_WORKSPACE = path.normalize(path.join(__dirname, '../../ws'));

describe('StackTrace test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 50);
        return (async () => {
            config = new StackTrace();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('stack trace test failure for long stack frames in recursive function.', function (done) {
        this.timeout(1000 * 50);
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

class StackTrace {
    get workspaceRoot() {
        return '6.recursivefunction';
    }

    get mainClass() {
        return 'RecursiveTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "RecursiveTest.java",
            lines: [8]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'RecursiveTest.java');
        const outputList = [];
        engine.registerHandler('breakpoint:*/RecursiveTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(8);
            const stackFrames =  await engine.stackTrace(detail.event.body.threadId);
            stackFrames.stackFrames.length.should.equal(1001);
            let level = 1;
            for (let sf of stackFrames.stackFrames) {
                const scopes = await engine.scopes(sf.id);
                console.log('***scopes', scopes);
                for (let scope of scopes.scopes) {
                    const variables = await engine.variables(scope.variablesReference);
                    for (let variable of variables.variables) {
                        console.log('******', variable);
                        if (variable.variablesReference > 0) {
                            console.log('----->', await engine.variables(variable.variablesReference));
                        }
                        if (variable.name === 'number') {
                            variable.type.should.equal('int');
                            variable.value.should.equal((level++).toString());
                        }
                    }
                }
            }

            await engine.resume(detail.event.body.threadId);
        });
    }
}