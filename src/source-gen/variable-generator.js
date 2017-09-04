import fs from 'fs-plus'
import _ from 'lodash'
let variables = [{
    type: 'int',
    name: 'i',
    value: (i) => {
        return i.toString();
    }
},
    {
        type: 'boolean',
        name: 'j',
        value: (i) => {
            return i % 2 ? "true" : "false";
        }
    },
    {
        type: 'String',
        name: 'str',
        value: (i) => {
            return `new String("the ${i}-th string.")`
        }
    }
    ,
    {
        type: 'int[]',
        name: 'ia',
        value: (i) => {
            return `new int[]{${i}}`
        }
    },
    {
        type: 'Object',
        name: 'obj',
        value: (i) => {
            return `new Object()`
        }
    },

    {
        type: 'List<String>',
        name: 'strList',
        value: (i) => {
            return `new ArrayList<>()`
        }
    },
    {
        type: 'String[][][]',
        name: 'multi',
        value: (i) => {
            return `new String[5][10][32]`
        }
    },
];
const array = [];
array.push('import java.util.*;\npublic class TooManyVariables {\n' +
    '    public void test() {\n        System.out.println("variable perf test.");\n    }');
for (let j = 0; j < 750; j++) {
    _.each(variables, (v, i) => {
        array.push(`    ${v.type} ${v.name}_${j} = ${v.value(j)};`);
    });
}
array.push(`}`);

fs.writeFileSync('C:\\ci_cc\\ci\\testcase\\7.variableperformance\\src\\main\\java\\TooManyVariables.java', array.join('\n'));