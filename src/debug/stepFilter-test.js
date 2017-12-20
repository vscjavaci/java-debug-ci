import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'

describe('StepFilter test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 60);
        return (async () => {
            config = new StepFilter();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass StepFilter test.', function (done) {
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

class StepFilter {
    get workspaceRoot() {
        return '24.step-fiters';
    }

    get mainClass() {
        return 'com.microsoft.app.App';
    }

    get stepFilters() {
        return {
            "classNameFilters": [
                "java.*",
                "javax.*",
                "com.sun.*",
                "sun.*",
                "sunw.*",
                "org.omg.*"
            ],
            "skipSynthetics": false,
            "skipStaticInitializers": false,
            "skipConstructors": false
        };
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'target/classes';
    }

    get projectName() {
        return 'java9-app';
    }
    get initialBreakpoints() {
        return [{
            relativePath: "com/microsoft/app/App.java",
            lines: [11]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, this.initialBreakpoints[0].relativePath);
        const expectedLine = 11;
        const outputList = [];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/App.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLine);
            const threads = await engine.threads();
            console.log('***threads', threads);
            let threadId;
            for (let thread of threads.threads) {
                if(thread.name ==='Thread [main]'){
                    threadId=thread.id;
                    console.log("***threadId",threadId);
                    break;
                }
            }
 await engine.stepIn(threadId,detail.id);
            const scopes = await engine.scopes(detail.id);
            console.log("111111111111111111111111111111");
            console.log('***scopes', scopes);

            /*
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                for (let variable of variables.variables) {
                    console.log('******', variable);
                    if (variable.variablesReference > 0) {
                        console.log('----->', await engine.variables(variable.variablesReference));
                    }
                    if (variable.name === 'args') {
                        variable.type.should.equal('String[]');
                        utils.shouldMatch(variable.value, /^String\[0]\s+\(id=\d+\)$/g);
                    }
                }
            }
            */
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            //detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            /*
            linePos.should.equal(expectedLines.length);
            utils.equalsWithoutLineEnding(outputList.join(''), 'hello world\r\n');
            */
        });
    }
}