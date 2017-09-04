import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'

chai.should();
const ROOT = path.normalize(path.join(__dirname, '../../testcase'));
const LANGUAGE_SERVER_ROOT = path.normalize(path.join(__dirname, '../../server'));
const LANGUAGE_SERVER_WORKSPACE = path.normalize(path.join(__dirname, '../../ws'));

describe('Variable performance test', function () {
    this.timeout(1000 * 20);
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new VariablePerf();
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

class VariablePerf {
    get workspaceRoot() {
        return '7.variableperformance';
    }

    get mainClass() {
        return 'VariablePerfTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "TooManyVariables.java",
            lines: [BREAK_POS]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'TooManyVariables.java');
        const outputList = [];
        const expectVariableList = {
            'i_749': {
                type: 'int',
                value: '749'
            }
        };
        engine.registerHandler('breakpoint:*/TooManyVariables.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(BREAK_POS);
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            console.log('***scopes', scopes);
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                for (let variable of variables.variables) {
                    // console.log('******', variable);
                    // if (variable.variablesReference > 0) {
                    //     console.log('----->', await engine.variables(variable.variablesReference));
                    // }
                    if (expectVariableList[variable.name]) {
                        utils.compareVariable(expectVariableList[variable.name], variable);
                    }
                }
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', async (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', async () => {
            outputList.join('').should.equal('variable perf test.\r\n');
        });
    }
}