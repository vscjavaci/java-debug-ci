import chai from 'chai'
import fs from 'fs-plus'
import _ from 'lodash'
const assert = chai.assert;
const isCaseInsensitive = fs.isCaseInsensitive();
export function pathEquals(file1, file2) {
    if (!isCaseInsensitive) {
        return file1 && file2 && file1.replace(/\\/g, '/') === file2.replace(/\\/g, '/');
    } else {
        return file1 && file2 && file1.replace(/\\/g, '/').toLowerCase() === file2.replace(/\\/g, '/').toLowerCase();
    }
}


export function validateResponse(response) {
    assert(response.success, `bad response: ${JSON.stringify(response, null, 4)}`);
}

export function shouldMatch(str, reg) {
    assert(reg.exec(str), `expected ${reg}, but acutally ${str}`);
}
const compare = (expect, actual) => {
    if (_.isString(expect)) {
        actual.should.equal(expect);
    } else if (expect.exec) {
        shouldMatch(actual, expect);
    }
};
export function compareVariable(expect, actual) {
    if (expect.type) {
        compare(expect.type, actual.type);
    }
    if (expect.value) {
        compare(expect.value, actual.value);
    }
}