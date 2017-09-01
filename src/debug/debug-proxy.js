import fs from 'fs-plus'
var net = require('net');
var HOST = '127.0.0.1';
var PORT = 3333;
import DebugSession from './debug-session'


var server = net.createServer();
server.listen(PORT, HOST, () => {
    console.log('Server listening on ' +
        server.address().address + ':' + server.address().port);
});


const myEncodeURI = (url) => {
    return encodeURIComponent(url.replace(/\\/g, '/'));
};

const initialProject = (session, rootPath) => {
    session.send({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": {
            "processId": process.pid,
            "rootPath": rootPath,
            "rootUri": 'file:///' + myEncodeURI(rootPath),
            "capabilities": {
                "workspace": {
                    "applyEdit": true,
                    "workspaceEdit": {"documentChanges": true},
                    "didChangeConfiguration": {"dynamicRegistration": false},
                    "didChangeWatchedFiles": {"dynamicRegistration": true},
                    "symbol": {"dynamicRegistration": true},
                    "executeCommand": {"dynamicRegistration": true}
                },
                "textDocument": {
                    "synchronization": {
                        "dynamicRegistration": true,
                        "willSave": true,
                        "willSaveWaitUntil": true,
                        "didSave": true
                    },
                    "completion": {"dynamicRegistration": true, "completionItem": {"snippetSupport": true}},
                    "hover": {"dynamicRegistration": true},
                    "signatureHelp": {"dynamicRegistration": true},
                    "references": {"dynamicRegistration": true},
                    "documentHighlight": {"dynamicRegistration": true},
                    "documentSymbol": {"dynamicRegistration": true},
                    "formatting": {"dynamicRegistration": true},
                    "rangeFormatting": {"dynamicRegistration": true},
                    "onTypeFormatting": {"dynamicRegistration": true},
                    "definition": {"dynamicRegistration": true},
                    "codeAction": {"dynamicRegistration": true},
                    "codeLens": {"dynamicRegistration": true},
                    "documentLink": {"dynamicRegistration": true},
                    "rename": {"dynamicRegistration": true}
                }
            },
            "trace": "off"
        }
    });
};

export function startDebugServer(projectRoot) {
    return new Promise(resolve => {
        server.on('connection', (sock) => {
            console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
            let session = new DebugSession(sock, sock);
            sock.on('error', err => {
                if (err)
                console.log('-------------------', err);
            });
            sock.on('close', (data) => {
                console.log('CLOSED: ' +
                    sock.remoteAddress + ' ' + sock.remotePort);
                session = null;
            });
            initialProject(session, projectRoot);
            session.on('ready', (data) => {
                console.log('ready', data);
                session.send({
                    "jsonrpc": "2.0",
                    "id": "startDebugServer",
                    "method": "java/startDebugSession",
                    "params": "vscode.java.debugsession"
                });
            });
            session.on('jsonrpc', (data) => {
                if (data.id === 'startDebugServer') {
                    console.log('Debug server started at ', data.result);
                    resolve(data.result);
                }
            });
        });
    });
}