import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'

describe('Encoding test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new Encoding();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass Encoding test.', function (done) {
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

class Encoding {
    get workspaceRoot() {
        return '14.encoding';
    }

    get mainClass() {
        return 'EncodingTest';
    }

     get encoding() {
        return 'GBK';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "EncodingTest.java",
            lines: [13]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'EncodingTest.java');
        const expectedLines = [13];
        const outputList = [];
        let linePos = 0;
        const expectVariableList = {
            'var': {
                type: 'java.lang.String',
                value: utils.wildcardToRegex('"abc中文def" (id=*)')
            }
        };
        engine.registerHandler('breakpoint:*/EncodingTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);
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
                        variable.type.should.equal('java.lang.String[]');
                        utils.shouldMatch(variable.value, /^java.lang.String\[0]\s+\(id=\d+\)$/g);
                    }  else if (expectVariableList[variable.name]) {
                        utils.compareVariable(expectVariableList[variable.name], variable);
                    }
                }
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            linePos.should.equal(expectedLines.length);
            utils.equalsWithoutLineEnding(outputList.join(''), 'abc中文def\n8\nDefault Charset=GBK\nfile.encoding=GBK\nDefault Charset in Use=GBK\n');
        });
    }
}