import chai from 'chai'
import path from 'path'
import _ from 'lodash'
import * as utils from './test-utils'

const assert = chai.assert;

chai.should();
const ROOT = path.normalize(path.join(__dirname, '../../testcase'));
const LANGUAGE_SERVER_ROOT = path.normalize(path.join(__dirname, '../../server'));
const LANGUAGE_SERVER_WORKSPACE = path.normalize(path.join(__dirname, '../../ws'));

describe('Library without source test', function () {
    this.timeout(1000 * 20);
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new NoSource();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass variable performance test.', function (done) {
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


const BREAK_POS = 4;

class NoSource {
    get workspaceRoot() {
        return '8.nosource';
    }

    get mainClass() {
        return 'NoSourceTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get classPath() {
        return ['lib/test1.jar', 'lib/commons-io-2.5.jar'];
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "NoSourceTest.java",
            lines: [BREAK_POS]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'NoSourceTest.java');
        const outputList = [];
        const expectVariableList = {
            'arg0': {
                type: 'int',
                value: '1'
            }
        };
        engine.registerHandler('breakpoint:*/NoSourceTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(BREAK_POS);
            const stackFrames = (await engine.stackTrace(detail.event.body.threadId)).stackFrames;
            console.log(stackFrames);
            const missingSourceStack = _.find(stackFrames, {line: -1, name: 'bar'});
            assert(missingSourceStack, 'should have the stackframe without source.');
            const scopes = await engine.scopes(missingSourceStack.id);
            console.log('***scopes', scopes);
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                for (let variable of variables.variables) {
                    console.log('******', variable);
                    if (variable.variablesReference > 0) {
                        console.log('----->', await engine.variables(variable.variablesReference));
                    }
                    if (expectVariableList[variable.name]) {
                        utils.compareVariable(expectVariableList[variable.name], variable);
                    }
                }
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', async (event, arg1, arg2, detail) => {
            console.log("****", detail.output);
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
        });
        engine.registerHandler('terminated', async () => {
            outputList.join('').includes('CA FE BA BE 00 00 00 34 00 5C 0A 00 14 00 1E 09').should.equal(true);
        });
    }
}