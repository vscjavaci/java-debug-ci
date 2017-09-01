import fs from 'fs-plus'

const isCaseInsensitive = fs.isCaseInsensitive();
export function pathEquals(file1, file2) {
    if (!isCaseInsensitive) {
        return file1 && file2 && file1.replace(/\\/g, '/') === file2.replace(/\\/g, '/');
    } else {
        return file1 && file2 && file1.replace(/\\/g, '/').toLowerCase() === file2.replace(/\\/g, '/').toLowerCase();
    }
}


export function validateResponse(response) {
    response.success.should.be.true;
}