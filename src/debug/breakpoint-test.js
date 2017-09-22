import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'

describe('BreakPoint test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new BreakPoint();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass BreakPoint test.', function (done) {
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

class BreakPoint {
    get workspaceRoot() {
        return '5.breakpoint';
    }

    get mainClass() {
        return 'BreakPointTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "BreakPointTest.java",
            lines: [3, 13, 30, 38]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'BreakPointTest.java');
        const expectedLines = [38, 30, 13];
        const outputList = [];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/BreakPointTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            linePos.should.equal(expectedLines.length);
            utils.equalsWithoutLineEnding(outputList.join(''), 'middle\ninner\nanonymous\n99\n');
        });
    }
}