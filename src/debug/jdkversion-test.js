import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import os from 'os'
import { exec } from 'child_process'
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'

describe('JdkVersion test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;

    beforeEach(function () {

        this.timeout(1000 * 20);
        return (async () => {
            config = new JdkVersionTest();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            let jdk9Home = process.env.JAVA_HOME9;
            if (!jdk9Home) {
                throw new Error("Can't find env JAVA_HOME9");
            }
            console.log("***** JAVA_HOME9 : " + jdk9Home);
            let startStr = `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=1044 JdkVersion`;
            let compileStr = `cd ${DATA_ROOT}/src/main/java&&javac -g ./JdkVersion.java`;
            let setpathStr = "";
            if (!os.platform() === 'win32') {
                setpathStr = `export JAVA_HOME=${jdk9Home}&&export PATH=${jdk9Home}/bin:$PATH`;
            } else {
                setpathStr = `set JAVA_HOME=\"${jdk9Home}\"`;
            }

            let cmdStr = [compileStr, setpathStr, startStr].join("&&");

            console.log("***** EXECUTE COMMAD " + cmdStr);
            console.log("***** current JAVA_HOME: " + process.env.JAVA_HOME);
            console.log("***** Start debugger with JAVA_HOME9: " + jdk9Home);
            exec(cmdStr, function (err, stdout, stderr) {
                if (err) {
                    throw err;
                } else {
                    console.log("Commad finished!")
                    console.log(stdout);
                }
            });

            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass Jdkversion test.', function (done) {
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

class JdkVersionTest {
    get workspaceRoot() {
        return '22.jdkversion';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get hostName() {
        return '127.0.0.1'
    }

    get port() {
        return '1044'
    }
    get initialBreakpoints() {
        return [{
            relativePath: "JdkVersion.java",
            lines: [11]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'JdkVersion.java');
        const expectedLine = 11;
        const outputList = [];
        engine.registerHandler('breakpoint:*/JdkVersion.java:*', async (event, arg1, arg2, detail) => {
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
                    if (variable.name === 'squareNums') {
                        variable.type.should.equal('float');
                        utils.shouldMatch(variable.value, /30.000000/)
                    }
                    if (variable.name === 'jdkVersion') {                       
                        let match = /\d\.\d\.\d/.exec(process.env.JAVA_HOME9);
                        variable.value.includes(match[0]).should.equal(true);
                    }

                }
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('console');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', () => {
            utils.equalsWithoutLineEnding(outputList.join('').replace(/:\s.*/g, ''), '[Warn] The debugger and the debuggee are running in different versions of JVMs. You could see wrong source mapping results.\nDebugger JVM version\nDebuggee JVM version');
        });
    }
}