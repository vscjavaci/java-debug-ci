import net from 'net';
import DebugSession from './debug-session'
import glob from 'glob'
import fs from 'fs-plus'
import path from 'path'
import { timeout } from './test-utils';
const HOST = '127.0.0.1';
const PORT = 3333;


let server;

const myEncodeURI = (url) => {
    return encodeURIComponent(url.replace(/\\/g, '/'));
};

const initialProject = (session, rootPath) => {
    let jars = glob.sync(path.normalize(path.join(__dirname, '../../../vscode-java-debug/server/com.microsoft.java.debug.plugin-*.jar')).replace(/\\/g, '/'));
    if (jars && jars.length) {
        jars = jars[0];
    } else {
        throw new Error('Cannot find com.microsoft.java.debug.plugin-*.jar');
    }
    console.log('using', jars);
    let configObj;
    if (rootPath.testName === "multi-root") {
        configObj = {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "initialize",
            "params": {
                "processId": process.pid,
                "rootPath": rootPath.petclinicPath,
                "rootUri": 'file:///' + myEncodeURI(rootPath.petclinicPath),
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
                        'file:///' + myEncodeURI(rootPath.petclinicPath),
                        'file:///' + myEncodeURI(rootPath.todoPath)
                    ]
                },
                "trace": "off",
                "workspaceFolders": [
                    {
                        "uri": 'file:///' + myEncodeURI(rootPath.petclinicPath),
                        "name": "spring-petclinic"
                    },
                    {
                        "uri": 'file:///' + myEncodeURI(rootPath.todoPath),
                        "name": "todo-app-java-on-azure"
                    }
                ]
            }
        };
    }
    else {
        configObj = {
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
                    ]
                },
                "trace": "off"
            }
        };
    }
    // console.log(JSON.stringify(configObj, null, 4))
    session.send(configObj);
};

export function startDebugServer(projectRoot, userSettings, config) {
    server = net.createServer();
    server.listen(PORT, HOST, () => {
        console.log('Server listening on ' +
            server.address().address + ':' + server.address().port);
    });
    return new Promise(resolve => {
        server.on('connection', (sock) => {
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
            if (config.testName === "multi-root") {
                initialProject(session, config);
            }
            else {
                initialProject(session, projectRoot);
            }
            session.on('ready', (data) => {
                console.log('ready', data);
                session.send({
                    "jsonrpc": "2.0",
                    "id": "updateDebugSettings",
                    "method": "workspace/executeCommand",
                    "params": { "command": "vscode.java.updateDebugSettings", "arguments": [JSON.stringify(userSettings)] }
                });

            });

            session.on('jsonrpc', (data) => {
                if (data.id === 'updateDebugSettings') {
                    console.log("updateDebugSettings:", data.result);
                    session.send({
                        "jsonrpc": "2.0",
                        "id": "compile",
                        "method": "java/buildWorkspace",
                        "params": true
                    });
                }
            });
            session.on('jsonrpc', (data) => {
                if (data.id === 'compile') {
                    console.log("compile result:", data.result);
                    session.send({
                        "jsonrpc": "2.0",
                        "id": "resolveMainClass",
                        "method": "workspace/executeCommand",
                        "params": { "command": "vscode.java.resolveMainClass", "arguments": [] }
                    });
                }

            });

            session.on('jsonrpc', (data) => {
                if (data.id === 'resolveMainClass') {
                    console.log('Resolve mainClass result----> ', data.result);
                    console.log('Resolve mainClass data id----> ', data.id);
                    if (config.testName === "multi-root") {
                        for (let result of data.result) {
                            if (result.projectName === "spring-petclinic") {
                                Object.defineProperties(config, {
                                    projectName: {
                                        value: result.projectName,
                                        writable: false
                                    },
                                    mainClass: {
                                        value: result.mainClass,
                                        writable: false
                                    }
                                });
                                break;
                            }
                        }
                    }
                    //resovle mainclass
                    let resolveMainClassResult = data.result;
                    let mainClass = new Array();
                    let projectName = config.projectName ? config.projectName : config.workspaceRoot;
                    resolveData.push(data.result);
                    if (!config.mainClass) {
                        for (let item in resolveMainClassResult) {
                            if (resolveMainClassResult[item]["projectName"] === projectName) {
                                mainClass.push(resolveMainClassResult[item]["mainClass"]);
                            }
                        }
                        if (mainClass.length <= 0) {
                            throw new Error("can't find mainClass");
                        }
                        Object.defineProperty(config, "mainClass", {
                            value: mainClass[0]
                        })
                    }
                    //only run when provide projectName
                    if (config.projectName) {
                        session.send({
                            "jsonrpc": "2.0",
                            "id": "resolveClasspath",
                            "method": "workspace/executeCommand",
                            "params": { "command": "vscode.java.resolveClasspath", "arguments": [config.mainClass, config.projectName] }
                        });
                    }
                    else {
                        session.send({
                            "jsonrpc": "2.0",
                            "id": "startDebugServer",
                            "method": "workspace/executeCommand",
                            "params": { "command": "vscode.java.startDebugSession", "arguments": [] }
                        });


                    }

                }
            });
            session.on('jsonrpc', (data) => {

                if (data.id === 'resolveClasspath' && config.projectName) {
                    //console.log('Resolve resolveClasspath result----> ', data.result);
                    //console.log('Resolve resolveClasspath data id----> ', data.id);
                    resolveData.push(data.result);
                    let resovleClasspathResult = data.result;
                    if (!config.classPath) {
                        Object.defineProperty(config, "classPath", {
                            value: resovleClasspathResult[1]
                        })
                    }
                    session.send({
                        "jsonrpc": "2.0",
                        "id": "startDebugServer",
                        "method": "workspace/executeCommand",
                        "params": { "command": "vscode.java.startDebugSession", "arguments": [] }
                    });
                }

                if (data.id === 'startDebugServer') {
                    console.log('Debug server started at ', data.result);
                    resolveData.push(data.result);
                    resolve(resolveData);

                }

            });


        });
    });
}


export function stopDebugServer() {
    server.close();
}