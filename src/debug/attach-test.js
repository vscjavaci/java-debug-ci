import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
var exec = require('child_process').exec; 
import {ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE} from './constants'

describe('Attach test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {

        this.timeout(1000 * 20);
        return (async () => {
            config = new AttachTest();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            let cmdStr = 'cd dir&&cd src&&javac ./test/attachdebug.java&&java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=1044 test.attachdebug';
            
             cmdStr=cmdStr.replace("dir",DATA_ROOT);
             exec(cmdStr, function (err, stdout, stderr) {
                if (err) {
                    console.log(stderr);
                } else {
                    console.log(stdout);
                }
            });
             
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE,config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass Attach test.', function (done) {
        this.timeout(1000 * 20);
        (async () => {
            try {
                await debugEngine.attach();
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

class AttachTest {
    get workspaceRoot() {
        return '18.attachdebug';
    }

    get sourcePath() {
        return 'src/test';
    }

    get outputPath() {
        return 'bin';
    }

    get hostName(){
        return '127.0.0.1'
    }

    get port(){
        return '1044'
    }
    get initialBreakpoints() {
        return [{
            relativePath: "attachdebug.java",
            lines: [11]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'attachdebug.java');
        const expectedLine = 11;
        const outputList = [];
        engine.registerHandler('breakpoint:*/attachdebug.java:*', async (event, arg1, arg2, detail) => {
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
                    if (variable.name === 'concat') {
                        variable.type.should.equal('java.lang.String[]');
                        utils.shouldMatch(variable.value, /^"ABCD"\s+\(id=\d+\)$/g);
                    }
                    if (variable.name === 'evens') {
                        utils.shouldMatch(variable.value, /^12\s+\(id=\d+\)$/g);
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
            utils.equalsWithoutLineEnding(outputList.join(''),'ABCD  12\r\n');
        });
    }
}