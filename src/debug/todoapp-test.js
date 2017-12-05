import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants';
import http from 'http';
import request from 'request';
import syncRequest from 'sync-request';
let randomStr = Date.now().toString();
const url = "http://localhost:8080";
describe('TodoApp test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    beforeEach(function () {
        this.timeout(1000 * 40);
        return (async () => {
            config = new TodoApp();
            DATA_ROOT = path.join(ROOT, config.workspaceRoot);
            debugEngine = await utils.createDebugEngine(DATA_ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
        })();
    });

    afterEach(() => {
        return debugEngine.close();
    });

    it('should pass TodoApp test.', function (done) {
        this.timeout(1000 * 40);
        (async () => {
            try {
                await debugEngine.launch();
                if (config.initialBreakpoints) {
                    for (let breakpoint of config.initialBreakpoints) {
                        const breakFile = path.join(DATA_ROOT, config.sourcePath, breakpoint.relativePath);
                        let temp = await debugEngine.setBreakpoints(breakFile, breakpoint.lines);
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

class TodoApp {
    get workspaceRoot() {
        return '24.todoapp';
    }

    get mainClass() {
        return 'com/microsoft/azure/sample/TodoApplication';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'target/classes';
    }

    get projectName() {
        return '24.todoapp';
    }
    get initialBreakpoints() {
        return [
            {
                relativePath: 'com/microsoft/azure/sample/TodoApplication.java',
                lines: [15]
            }
            ,
            {
                relativePath: 'com/microsoft/azure/sample/controller/TodoListController.java',
                lines: [69]
            }

        ];
    }

    withEngine(engine) {
        const outputList = [];

        let postData = {
            "description": "Breakfast" + randomStr,
            "owner": "barney",
            "finish": "false"
        };
        let postRequest = {
            url: url + '/api/todolist',
            port: 8080,
            method: 'POST',
            body: postData,
            json: true
        };
        engine.registerHandler('breakpoint:*/TodoApplication.java:*', async (event, arg1, arg2, detail) => {
            const breakpointFile = path.join(engine.cwd, this.sourcePath, 'com/microsoft/azure/sample/TodoApplication.java');
            const expectedLines = [15];
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            console.log("### Hit breakPoint:15");
            console.log('***threads', await engine.threads());
            const scopes = await engine.scopes(detail.id);
            await engine.resume(detail.event.body.threadId);

        });

        engine.registerHandler('breakpoint:*/TodoListController.java:*', async (event, arg1, arg2, detail) => {
            const breakpointFile = path.join(engine.cwd, this.sourcePath, 'com/microsoft/azure/sample/controller/TodoListController.java');
            const expectedLines = [69];
            console.log("### Hit #breakPoint:69");
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            await engine.resume(detail.event.body.threadId);

            //wait one second to let the app handle the post request
            await utils.timeout(1000);
            console.log("Send Get Request");
            let getRes = syncRequest('GET', url + '/api/todolist');
            let getResBody = JSON.parse(getRes.getBody('utf8'));
            console.log(getResBody);
            let descriptions = [];
            for (let index in getResBody) {
                descriptions.push(getResBody[index].description);
            }
            console.log(descriptions);
            let index = descriptions.indexOf("Breakfast" + randomStr);
            (index >= 0).should.equal(true);
            //delete the item
            let deleteResult = syncRequest('DELETE', url + '/api/todolist/' + getResBody[index].id).getBody('utf8');
            console.log("Delete result:" + deleteResult);
            engine.debugClient.emit('terminated');
        });

        engine.registerHandler('output*', (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output);
            if (detail.output.includes("Started TodoApplication")) {
                console.log("send request to hit second BP");
                request(postRequest, function (err, res, body) {
                    if (err) {
                        throw err;
                    }
                });

            }
        });
        engine.registerHandler('terminated', () => {
            console.log("Test ends!!");
        });
    }
}