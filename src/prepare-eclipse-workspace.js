import fs from 'fs-plus';
import path from 'path';
import glob from 'glob';
import * as util from './util';
import childProcess from 'child_process';
import BufferedProcess from './bufferred-process';

export default async function execute(args) {
  let exitcode = await util.executeWithProgress(`${args.cwd}/gradlew.bat`, 
  ['cleanEclipse', 
  'eclipse', 
  `-DjdkSource="${args.jdk_source.replace(/\\/g, '/')}"`,
  `-DextLib="${args.lib.replace(/\\/g, '/')}"`],
  args.cwd, (data)=> {
    console.log(data);
  });
   if (exitcode !== 0) {
      throw new Error(`gradle failure with error code ${exitcode}`);
  }
}
