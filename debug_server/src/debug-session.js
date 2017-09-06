import { EventEmitter} from 'events'
const TWO_CRLF = "\r\n\r\n";
export default class DebugSession extends EventEmitter {
    constructor(input, output) {
        super();
        this.input = input;
        this.output = output;
        this._rawData = new Buffer(0);
        this._contentLength =  -1;
        this._pendingRequests = {};

        this.input.on('data', (data) => {
            this._handleData(data);
        });
    }

    _handleData(data) {
        this._rawData = Buffer.concat([this._rawData, data]);

        while (true) {
            if (this._contentLength >= 0) {
                if (this._rawData.length >= this._contentLength) {
                    const message = this._rawData.toString('utf8', 0, this._contentLength);
                    this._rawData = this._rawData.slice(this._contentLength);
                    this._contentLength = -1;
                    if (message.length > 0) {
                        try {
                            let msg = JSON.parse(message);
                            this.handleMessage(msg);
                        }
                        catch (e) {
                            this.emit('error', new Error('error'));
                        }
                    }
                    continue;	// there may be more complete messages to process
                }
            } else {
                const idx = this._rawData.indexOf(TWO_CRLF);
                if (idx !== -1) {
                    const header = this._rawData.toString('utf8', 0, idx);
                    const lines = header.split('\r\n');
                    for (let i = 0; i < lines.length; i++) {
                        const pair = lines[i].split(/: +/);
                        if (pair[0] == 'Content-Length') {
                            this._contentLength = +pair[1];
                        }
                    }
                    this._rawData = this._rawData.slice(idx + TWO_CRLF.length);
                    continue;
                }
            }
            break;
        }
    }


    dispatchRequest(request) {
        console.log('>', request);
    }

    dispatchRequest(request) {
        console.log('>', request);
    }
    handleMessage(msg) {
        if (msg.method === 'window/logMessage') {
            console.log(msg.params.message);
        } else if (msg.method === 'language/status') {
            if (msg.params.type === 'Started') {
                this.emit('ready', msg.params);
            }
            console.log(msg.params.type, msg.params.message);
        } else {
            if (msg.jsonrpc) {
                this.emit('jsonrpc', msg);
            }
            else console.log('x', msg);
        }
    }

    outputError(data) {
        this.output.write(JSON.stringify({
            error:data
        }, null, 4) + '\n');
    }

    send(data) {
        const json = JSON.stringify(data);
        this.output.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
    }
}