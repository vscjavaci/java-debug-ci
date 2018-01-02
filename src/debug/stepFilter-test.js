import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'
import fs from 'fs'

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
        return '14.encoding';
    }

    get mainClass() {
        return 'EncodingTest';
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
        return 'bin';
    }

    get encoding() {
        return 'GBK';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "EncodingTest.java",
            lines: [11]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, this.initialBreakpoints[0].relativePath);
        const expectedLines = [11, 12];
        const outputList = [];
        engine.registerHandler('breakpoint:*/EncodingTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[0]);
            const threads = await engine.threads();
            console.log('***threads', threads);
            const scopes = await engine.scopes(detail.id);
            await engine.stepIn(detail.event.body.threadId);
        });

        engine.registerHandler('step:*EncodingTest.java:*', async (event, arg1, arg2, detail) => {
            detail.line.should.equal(expectedLines[1]);
    
            await engine.resume(detail.event.body.threadId);
        });

        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });

        engine.registerHandler('terminated', () => {
            utils.equalsWithoutLineEnding(outputList.join(''), 'abc中文def\n8\nDefault Charset=GBK\nfile.encoding=GBK\nDefault Charset in Use=GBK\n');
        });
    }
}