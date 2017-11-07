import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'

describe('Args test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new ArgsTest();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass Args test.', function (done) {
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

class ArgsTest {
    get workspaceRoot() {
        return '17.argstest';
    }

    get mainClass() {
        return 'test.ArgsTest';
    }

    get sourcePath() {
        return 'src/test';
    }

    get outputPath() {
        return 'bin';
    }

    get args(){
        return "pro1 pro2 pro3"
    }

    get vmArgs(){
        return "-DsysProp1=sp1  -DsysProp2=sp2"
    }

    get encoding(){
        return "UTF-16";
    }

    get initialBreakpoints() {
        return [{
            relativePath: "ArgsTest.java",
            lines: [20]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'ArgsTest.java');
        const expectedLine = 20;
        const outputList = [];
        engine.registerHandler('breakpoint:*/ArgsTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLine);
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
                        utils.shouldMatch(variable.value, /^java.lang.String\[3]\s+\(id=\d+\)$/g);
                    }
                    if (variable.name === 'sysProp1Value') {
                        utils.shouldMatch(variable.value, /^"sp1"\s+\(id=\d+\)$/g);
                    }
                    if (variable.name === 'sysProp2Value') {
                        utils.shouldMatch(variable.value, /^"sp2"\s+\(id=\d+\)$/g);
                    }
                    if (variable.name === 'encoding') {
                        utils.shouldMatch(variable.value, /^"UTF-16"\s+\(id=\d+\)$/g);
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
            utils.equalsWithoutLineEnding(outputList.join(''), 
            'Program Arguments:pro1 pro2 pro3 VM Arguments:sp1 sp2\r\n');
        });
    }
}