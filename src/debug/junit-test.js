import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
const ROOT = path.normalize(path.join(__dirname, '../../testcase'));
const LANGUAGE_SERVER_ROOT = path.normalize(path.join(__dirname, '../../../java-debug/jdtls'));
const LANGUAGE_SERVER_WORKSPACE = path.normalize(path.join(__dirname, '../../ws'));

describe('Debug JUnit test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new JUnit();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should be able to debug JUnit test.', function (done) {
        this.timeout(1000 * 20);
        (async () => {
            try {
                await debugEngine.launch();
                if (config.initialBreakpoints) {
                    for (let breakpoint of config.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, config.testPath, breakpoint.relativePath);
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

class JUnit {
    get workspaceRoot() {
        return '10.junit';
    }

    get mainClass() {
        return 'org.junit.runner.JUnitCore';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get testPath() {
        return 'src/test/java';
    }

    get outputPath() {
        return 'bin';
    }

    get classPath() {
        return ['lib/junit-4.12.jar', 'lib/hamcrest-core-1.3.jar'];
    }

    get initialBreakpoints() {
        return [{
            relativePath: "MyTest.java",
            lines: [10, 16]
        }];
    }

    get args() {
        return "MyTest";
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.testPath, 'MyTest.java');
        const outputList = [];
        engine.registerHandler('breakpoint:*/MyTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            if ([10, 16].indexOf(detail.line) < 0) {
                assert.fail(`bad line number ${detail.line}`);
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            outputList.join('').includes('OK (2 tests)').should.equal(true);
        });
    }
}