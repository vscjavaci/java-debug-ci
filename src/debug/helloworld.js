import path from 'path'
import * as utils from './test-utils'

export class HelloWorld {
    get workspaceRoot() {
        return '1.helloworld';
    }

    get mainClass() {
        return 'HelloWorld';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "HelloWorld.java",
            lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'HelloWorld.java');
        const expectedLines = [3, 4, 10, 12];
        const outputList = [];
        let linePos = 0;
        engine.registerHandler('breakpoint:*/HelloWorld.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(expectedLines[linePos++]);
            console.log(await engine.threads());
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', async (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', async () => {
            outputList.join().should.equal('hello, world\r\n');
        });
    }
}




