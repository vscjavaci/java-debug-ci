import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants'
import { startLS, isLanguageServerStarted, killLanguageServer } from './jdt-ls-starter'
import fs from 'fs'
import { assert } from 'chai'
import net, { Socket } from 'net';
import DebugSession from './debug-session'
import mkdirp from 'mkdirp'
import glob from 'glob'
import { execSync } from 'child_process'
var rimraf = require('rimraf');
const HOST = '127.0.0.1';
const PORT = 3333;
let server;

describe('multi-root test', () => {
    let DATA_ROOT;
    let promise2;
    let another_root;
    let socket;

    const projectPath = path.join(ROOT, "25.multi-root");
    if (!fs.existsSync(projectPath)) {
        console.log("****", "Clone project");
        let downloadCmd = `cd ${ROOT}` + '&& mkdir 25.multi-root' + '&& cd 25.multi-root' + '&& git clone https://github.com/spring-projects/spring-petclinic.git';
        let downloadCmd1 = `cd ${projectPath}` + '&& git clone https://github.com/Microsoft/todo-app-java-on-azure.git';
        execSync(downloadCmd, { stdio: [0, 1, 2] });
        if (fs.existsSync(projectPath)) {
            execSync(downloadCmd1, { stdio: [0, 1, 2] });
        }
        console.log("****", "Clone finished");
    }
    DATA_ROOT = path.join(ROOT, "25.multi-root/spring-petclinic");
    another_root = path.join(ROOT, "25.multi-root/todo-app-java-on-azure");
    let path1 = path.join(DATA_ROOT, '.project');
    let path2 = path.join(another_root, '.project');

    const myEncodeURI = (url) => {
        return encodeURIComponent(url.replace(/\\/g, '/'));
    };
    const initialProject = (session, rootPath, anotherPath) => {
        let jars = glob.sync(path.normalize(path.join(__dirname, '../../../vscode-java-debug/server/com.microsoft.java.debug.plugin-*.jar')).replace(/\\/g, '/'));
        if (jars && jars.length) {
            jars = jars[0];
        } else {
            throw new Error('Cannot find com.microsoft.java.debug.plugin-*.jar');
        }
        console.log('using', jars);
        let configObj = {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "initialize",
            "params": {
                "processId": process.pid,
                "rootPath": rootPath,
                "rootUri": 'file:///' + myEncodeURI(rootPath),
                "capabilities": {
                    "workspace": {
                        "didChangeConfiguration": {
                            "dynamicRegistration": true
                        },
                        "didChangeWatchedFiles": {
                            "dynamicRegistration": true
                        },
                        "symbol": {
                            "dynamicRegistration": true
                        },
                        "executeCommand": {
                            "dynamicRegistration": true
                        }
                    },
                    "textDocument": {
                        "synchronization": {
                            "dynamicRegistration": true,
                            "willSave": true,
                            "willSaveWaitUntil": true,
                            "didSave": true
                        },
                        "completion": {
                            "dynamicRegistration": true,
                            "completionItem": {
                                "snippetSupport": true
                            }
                        },
                        "hover": {
                            "dynamicRegistration": true
                        },
                        "signatureHelp": {
                            "dynamicRegistration": true
                        },
                        "definition": {
                            "dynamicRegistration": true
                        },
                        "references": {
                            "dynamicRegistration": true
                        },
                        "documentHighlight": {
                            "dynamicRegistration": true
                        },
                        "documentSymbol": {
                            "dynamicRegistration": true
                        },
                        "codeAction": {
                            "dynamicRegistration": true
                        },
                        "codeLens": {
                            "dynamicRegistration": true
                        },
                        "formatting": {
                            "dynamicRegistration": true
                        },
                        "rangeFormatting": {
                            "dynamicRegistration": true
                        },
                        "onTypeFormatting": {
                            "dynamicRegistration": true
                        },
                        "rename": {
                            "dynamicRegistration": true
                        },
                        "documentLink": {
                            "dynamicRegistration": true
                        }
                    }
                },
                "initializationOptions": {
                    "bundles": [
                        jars
                    ],
                    "workspaceFolders": [
                        'file:///' + myEncodeURI(rootPath),
                        'file:///' + myEncodeURI(anotherPath)
                    ]
                },
                "trace": "off",
                "workspaceFolders": [
                    {
                        "uri": 'file:///' + myEncodeURI(rootPath),
                        "name": "spring-petclinic"
                    },
                    {
                        "uri": 'file:///' + myEncodeURI(anotherPath),
                        "name": "todo-app-java-on-azure"
                    }
                ]
            }
        };
        session.send(configObj);
    };
    const initializeProject = function (rootPath, anotherPath) {
        server = net.createServer();
        server.listen(PORT, HOST, () => {
            console.log('Server listening on ' +
                server.address().address + ':' + server.address().port);
        });

        server.on('connection', (sock) => {
            socket = sock;
            console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
            let session = new DebugSession(sock, sock);
            let resolveData = new Array();
            sock.on('error', err => {
                if (err)
                    console.log('-------------------', err);
            });
            sock.on('close', (data) => {
                console.log('CLOSED: ' +
                    sock.remoteAddress + ' ' + sock.remotePort);
                session = null;
            });
            initialProject(session, rootPath, anotherPath);
            session.on('ready', (data) => {
                console.log("verify target exesits");
                assert(fs.existsSync(path1) && fs.existsSync(path2));
                session.send({
                    "jsonrpc": "2.0",
                    "id": "resolveMainClass",
                    "method": "workspace/executeCommand",
                    "params": { "command": "vscode.java.resolveMainClass", "arguments": [] }
                });
            });
            session.on('jsonrpc', (data) => {
                if (data.id === 'resolveMainClass') {
                    console.log("remianclass****", data.result);
                    assert(data.result.length === 2);
                    for (let result of data.result) {
                        assert(result.mainClass);
                        assert(result.projectName);
                        if (result.mainClass === "org.springframework.samples.petclinic.PetClinicApplication") {
                            assert(result.projectName === "spring-petclinic");
                        }
                        if (result.mainClass === "com.microsoft.azure.sample.TodoApplication") {
                            assert(result.projectName === "todo-app-java-on-azure");
                        }
                    }
                    console.log("Test successfully");
                    socket.end();
                    socket.destory();
                }
            });
        });
    };

    beforeEach(function () {
        //assert(!(fs.existsSync(path1)||fs.existsSync(path2)));
        utils.timeout(1000 * 20);
        initializeProject(DATA_ROOT, another_root);
    })

    it('multi-root test', function () {
        this.timeout(1000 * 50);
        (async () => {
            //await initializeProject(DATA_ROOT, another_root);
            mkdirp.sync(LANGUAGE_SERVER_WORKSPACE);
            if (isLanguageServerStarted()) {
                console.log('waiting for ls down.');
                await killLanguageServer();
                await timeout(1000);
            }
            try {
                rimraf.sync(LANGUAGE_SERVER_WORKSPACE);
            } catch (e) {
                throw new Error(`Can't delete ${LANGUAGE_SERVER_WORKSPACE} folder`);
            }
            startLS(LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE);
            // await utils.timeout(1000*50);   
        })();

    })

});
