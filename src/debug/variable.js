import path from 'path'
import * as utils from './test-utils'
const BREAK_POS = 49
export class Variable {
    get workspaceRoot() {
        return '4.variable';
    }

    get mainClass() {
        return 'VariableTest';
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'bin';
    }

    get initialBreakpoints() {
        return [{
            relativePath: "VariableTest.java",
            lines: [BREAK_POS]
        }];
    }

    withEngine(engine) {
        const breakpointFile = path.join(engine.cwd, this.sourcePath, 'VariableTest.java');
        const outputList = [];
        const expectVariableList = {
            'arrays': {
                type: 'int[]',
                value: ''
            },
            'i': {
                type: 'int',
                value: '111'
            },
            'nullstr': {
                type: 'null',
                value: 'null'
            },
            'str': {
                value: /^\"string\stest[a]+\.+\"\s+\(id=\d+\)$/g,
                type: 'java.lang.String',
            }
        };
        engine.registerHandler('breakpoint:*/VariableTest.java:*', async (event, arg1, arg2, detail) => {
            utils.pathEquals(breakpointFile, detail.source.path).should.equal(true);
            detail.line.should.equal(BREAK_POS);
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
                    if (variable.name === 'args') {
                        variable.type.should.equal('java.lang.String[]');
                        utils.shouldMatch(variable.value, /^java.lang.String\[0]\s+\(id=\d+\)$/g);
                    } else if (expectVariableList[variable.name]) {
                        utils.compareVariable(expectVariableList[variable.name], variable);
                    }
                }
            }
            await engine.resume(detail.event.body.threadId);
        });
        engine.registerHandler('output*', async (event, arg1, arg2, detail) => {
            detail.category.should.equal('stdout');
            outputList.push(detail.output);
            console.log("****", detail.output)
        });
        engine.registerHandler('terminated', async () => {
            outputList.join().should.equal('0\r\n');
        });
    }
}




