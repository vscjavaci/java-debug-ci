import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'
import fs from 'fs'
import fsp from 'fs-plus'
import { assert } from 'chai'
let isDefaultSetting = true;

describe('UserSettings test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;

    beforeEach(function () {
        this.timeout(1000 * 20);
        return (async () => {
            config = new UserSettings();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        isDefaultSetting = false;
        return debugEngine.close();
    });

    let debugSetting = function (done) {
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
                logLevelTest();
                await utils.timeout(1000);
                done();
            } catch (error) {
                done(error);
                throw error;
            }
        })();

    };

    let logLevelTest = () => {
        let pathLog = path.join(LANGUAGE_SERVER_WORKSPACE, '.metadata', '.log');
        if (fsp.existsSync(pathLog)) {
            let logText = fs.readFileSync(pathLog, 'utf-8');
            const info = "!MESSAGE Set log level to : INFO";
            if (isDefaultSetting) {
                console.log("****", "test logLevel=info");
                assert(logText.includes(info));
            }
            else {
                console.log("****", "test logLevel=warning");
                assert(!logText.includes(info));
            }
        }
        else {
            throw new error(`${pathLog} doesn't exist.`);
        }
    };

    it('should pass Usersettings test with default setting.', (done) => {
        return debugSetting(done);
    });

    it('should pass Usersettings test with undefault setting.', (done) => {
        return debugSetting(done);
    });

});

class UserSettings {
    get workspaceRoot() {
        return '20.usersettings';
    }

    get sourcePath() {
        return 'src/main/java/usersettings';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "UserSettings.java",
            lines: [8, 9]
        }];
    }

    get userSettings() {
        return isDefaultSetting ? undefined : {
            "logLevel": "WARNING",
            "maxStringLength": 4,
            "showStaticVariables": false,
            "showQualifiedNames": true,
            "showHex": true
        };
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'UserSettings.java');
        const expectedLines = [8, 9];
        const outputList = [];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/UserSettings.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            console.log('***scopes', scopes);
            for (let scope of scopes.scopes) {
                const variables = await engine.variables(scope.variablesReference);
                const length = variables.variables.length;
                for (let variable of variables.variables) {
                    console.log('******', variable);
                    if (variable.variablesReference > 0) {
                        console.log('----->', await engine.variables(variable.variablesReference));
                    }
                    if (isDefaultSetting === true) {
                        utils.compareVariable(3, length);
                        if (variable.name === 'args') {
                            variable.type.should.equal('String[]');
                            utils.shouldMatch(variable.value, /^String\[0]\s+\(id=\d+\)$/g);
                        }
                        if (variable.name === "number") {
                            console.log("****", "Test showStaticVariables");
                            variable.type.should.equal('int');
                            utils.compareVariable(10, variable.value);
                        }

                        if (variable.name === "testName") {
                            variable.type.should.equal('String');
                            utils.compareVariable('userSettings', variable.value);
                        }
                    }
                    else {
                        utils.compareVariable(2, length);
                        if (variable.name === 'args') {
                            console.log("****", "Test showHex and ShowQualifiedNames");
                            variable.type.should.equal('java.lang.String[]');
                            utils.shouldMatch(variable.value, /^java.lang.String\[0x0]\s+\(id=0x\d+\)$/g);
                        }

                        if (variable.name === "testName") {
                            console.log("****", "Test maxStringLength");
                            variable.type.should.equal('java.lang.String');
                            utils.compareVariable(4, variable.length);
                            utils.compareVariable('user', variable.value);
                        }
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

        });
    }
}
