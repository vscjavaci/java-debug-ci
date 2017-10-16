import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'
const assert = chai.assert;

describe('ThirdParty Library(Lucene) test', () => {
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

    it('stack trace test failure for third-party library(lucene) .', function (done) {
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
        return '9.realcase.lucene';
    }

    get mainClass() {
        return 'LuceneTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }
    get classPath() {
        return ['lib/lucene-core-6.6.0.jar', 'lib/lucene-queryparser-6.6.0.jar', 'lib/lucene-sandbox-6.6.0.jar',
            'lib/lucene-queries-6.6.0.jar',
            'lib/lucene-analyzers-common-6.6.0.jar', 'lib/commons-io-2.5.jar'];
    }
    get initialBreakpoints() {
        return [{
            relativePath: "LuceneTest.java",
            lines: [45]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'LuceneTest.java');
        const outputList = [];
        engine.registerHandler('output*', async (event, arg1, arg2, detail) => {
            console.log("****", detail.output);
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
        });
        const expectVariableList = {
            'args': {
                type: 'java.lang.String[]',
                value: utils.wildcardToRegex('java.lang.String[0] (id=*)')
            },
            'file': {
                type: 'java.io.File',
                value: utils.wildcardToRegex('java.io.File (id=*)')
            },
            'documents': {
                type: 'java.util.ArrayList',
            },
            'document1': {
                type: 'org.apache.lucene.document.Document',
                value: utils.wildcardToRegex('org.apache.lucene.document.Document (id=*)')
            },
            'indexDirectory' : {
                type: 'java.lang.String'
            }
        };
        engine.registerHandler('breakpoint:*/LuceneTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(45);

            const scopes = await engine.scopes(detail.id);
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

            await engine.stepIn(detail.event.body.threadId);
        });
        const expectedLines = [1360, 1380, 763, 1382, 1384];
        let linePos = 0;
        engine.registerHandler('step:*IndexWriter.class:*', async (event, arg1, arg2, detail) => {
            detail.line.should.equal(expectedLines[linePos++]);

            const scopes = await engine.scopes(detail.id);
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                for (let variable of variables.variables) {
                    console.log('******', variable);
                    if (variable.name === 'this') {
                        assert(variable.variablesReference > 0, 'IndexWriter should have variablesReference');
                        utils.compareVariable({
                            type: 'org.apache.lucene.index.IndexWriter'
                        }, variable);
                    }
                }
            }

            if (detail.line === 763) {
                await engine.stepOut(detail.event.body.threadId);
            } else if (detail.line === 1382) {
                await engine.stepOver(detail.event.body.threadId);
            } else if (detail.line === 1384) {
                await engine.resume(detail.event.body.threadId);
            } else {
                await engine.stepIn(detail.event.body.threadId);
            }
        });

        engine.registerHandler('terminated', () => {
            linePos.should.equal(expectedLines.length);
            utils.equalsWithoutLineEnding(outputList.join(''), 'Total Results :: 1\r\n2, jinbwan@microsoft.com, Jinbo\r\nTotal Results :: 1\r\n1, andxu@microsoft.com, Andy\r\n');
        });
    }
}