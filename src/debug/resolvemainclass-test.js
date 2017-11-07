import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'

describe('ResolveMainClass test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new ResolveMainClass();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass ResolveMainClass test.', function (done) {
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

class ResolveMainClass {
    get workspaceRoot() {
        return '16.resolvemainclass';
    }


    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "MyApp.java",
            lines: [12]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'MyApp.java');
        const expectedLine = 12;
        const outputList = [];
        engine.registerHandler('breakpoint:*/MyApp.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLine);
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            utils.equalsWithoutLineEnding(outputList.join(''), 'Hello App!\r\n');
        });
    }
}