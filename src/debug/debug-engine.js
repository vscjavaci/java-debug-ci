import _ from 'lodash'
import * as utils from './test-utils'
import {stopDebugServer} from './debug-proxy'
const myReplace = str => {
    return str ? str.replace(/\:/g, '%3A').replace(/\s/, '%20') : str;
};

export class DebugEngine {
    constructor(rootPath, dc, launchConfig) {
        this.cwd = rootPath;
        this.handlers = {};
        this.debugClient = dc;
        this.launchConfig = launchConfig;
        this.promise = new Promise((resolve, reject) => {
            this.promiseResolve = resolve;
            this.promiseReject = reject;
        });
    }

    async handleEvent(eventName, argument1, argument2, details) {
        try {
            const eventStr = _.map(_.compact([eventName, argument1, argument2]), myReplace).join(':');
            for (let key of Object.keys(this.handlers)) {
                const reg = utils.wildcardToRegex(key);
                if (reg.exec(eventStr)) {
                    const res = this.handlers[key](eventName, argument1, argument2, details);
                    if (res) {
                        await Promise.resolve(res);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            this.promiseReject(err);
        }
    }

    registerHandler(event, func) {
        this.handlers[event] = func;
    }

    async launch() {
        const response = await this.debugClient.launchRequest(this.launchConfig);
        utils.validateResponse(response);
        return response.body;
    }

    async attach() {
        const response = await this.debugClient.attachRequest(this.launchConfig);
        utils.validateResponse(response);
        return response.body;
    }

    async setBreakpoints(file, lines) {
        const response = await this.debugClient.setBreakpointsRequest({
            lines: lines,
            breakpoints: _.map(lines, d => {
                return {line: d};
            }),
            source: {path: file}
        });
        utils.validateResponse(response);
        return response.body;
    }

    async startDebug() {
        const response = await this.debugClient.configurationDoneRequest();
        utils.validateResponse(response);
        return response.body;
    }

    async resume(threadId) {
        const response = await this.debugClient.continueRequest({threadId});
        utils.validateResponse(response);
        return response.body;
    }

    async stepIn(threadId) {
        const response = await this.debugClient.stepInRequest({threadId});
        utils.validateResponse(response);
        return response.body;
    }

    async stepOut(threadId) {
        const response = await this.debugClient.stepOutRequest({threadId});
        utils.validateResponse(response);
        return response.body;
    }

    async stepOver(threadId) {
        const response = await this.debugClient.nextRequest({threadId});
        utils.validateResponse(response);
        return response.body;
    }

    async threads() {
        const response = await this.debugClient.threadsRequest();
        utils.validateResponse(response);
        return response.body;
    }

    async scopes(stackFrameId) {
        const response = await this.debugClient.scopesRequest({frameId: stackFrameId});
        utils.validateResponse(response);
        return response.body;
    }

    async variables(variableId) {
        const response = await this.debugClient.variablesRequest({variablesReference: variableId});
        utils.validateResponse(response);
        return response.body;
    }

    async stackTrace(threadId) {
        const response = await this.debugClient.stackTraceRequest({
            threadId
        });
        utils.validateResponse(response);
        return response.body;
    }

    close() {
        const socket = this.debugClient._socket;
        socket.end();
        socket.destroy();
        stopDebugServer();
    }

    async waitForTerminate() {
        let res = await Promise.all([this.promise, this.debugClient.waitForEvent('terminated')]);
        return res[1];
    }
}