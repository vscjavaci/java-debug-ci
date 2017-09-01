import _ from 'lodash'
import * as utils from './test-utils'


const myReplace = str => {
    return str ? str.replace(/\:/g, '%3A').replace(/\s/, '%20') : str;
};
export class DebugEngine {
    constructor(rootPath, dc) {
        this.cwd = rootPath;
        this.handlers = {};
        this.dc = dc;
    }

     async handleEvent(eventName, argument1, argument2, details) {
        const eventStr = _.map(_.compact([eventName,argument1, argument2]), myReplace).join(':');
        for(let key of Object.keys(this.handlers)) {
            const reg = new RegExp("^" + key.split("*").join(".*") + "$");
            if (reg.exec(eventStr)) {
                const res = this.handlers[key](eventName, argument1, argument2, details);
                if (res) {
                    await Promise.resolve(res);
                }
            }
        }
    }
    registerHandler(event, func) {
        this.handlers[event] = func;
    }

    resume(threadId) {
        return this.dc.continueRequest({threadId});
    }

    async threads() {
        const response = await this.dc.threadsRequest();
        utils.validateResponse(response);
        return response.body;
    }

}