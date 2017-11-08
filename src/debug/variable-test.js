import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'
describe('Variable test', function() {
    this.timeout(1000 * 20);
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        return (async () => {
            config = new Variable();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass Variable test.', function(done) {
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


const BREAK_POS = 49;
class Variable {
    get workspaceRoot() {
        return '4.variable';
    }

    get mainClass() {
        return 'VariableTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "VariableTest.java",
            lines: [BREAK_POS]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'VariableTest.java');
        const outputList = [];
        const expectVariableList = {
            'arrays': {
                type: 'int[]',
                value: ''
            },
            'i': {
                type: 'int',
                value: '111'
            },
            'nullstr': {
                type: 'null',
                value: 'null'
            },
            'str': {
                value: /^\"string\stest[a]+\"\s+\(id=\d+\)$/g,
                type: 'String',
            }
        };
        engine.registerHandler('breakpoint:*/VariableTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(BREAK_POS);
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            console.log('***scopes', scopes);
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
                    } else if (expectVariableList[variable.name]) {
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
            utils.equalsWithoutLineEnding(outputList.join(''), '0\r\n');
        });
    }
}