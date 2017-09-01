import fs from 'fs-plus'
import path from 'path'
import {resolveJdkPath} from './java-executor'
import {parseString} from 'xml2js'
import BufferedIOProcess from './bufferred-io-process';
import glob from 'glob';

export async function startLS(location, workspacePath) {
    const jdkHome = await resolveJdkPath();
    if (!fs.isDirectorySync(jdkHome)) {
        throw new Error('missing jdk.')
    }
    const javaexe = path.join(jdkHome, 'bin', 'java.exe');
    if (!fs.isFileSync(javaexe)) {
        throw new Error(`Missing java.exe from path ${jdkHome}`);
    }
    let exitCode = -1;
    const outputFunc = (data, cat) => {
        if (cat === 'stderr') {
            console.error(data);
        } else {
            console.log('*' + data);
        }
    };
    let classpath = [];
    let params = [];
    params.push('-Declipse.application=org.eclipse.jdt.ls.core.id1');
    params.push('-Dosgi.bundles.defaultStartLevel=4');
    params.push('-Declipse.product=org.eclipse.jdt.ls.core.product');

    params.push('-Dlog.protocol=true');
    params.push('-Dlog.level=ALL');
    params.push('-Djdt.ls.debug=true');
    '-noverify -Xmx1G -XX:+UseG1GC -XX:+UseStringDeduplication'.split(' ').forEach(d => params.push(d));
    let server_home = location.replace(/\\/g, '/');
    let launchersFound = glob.sync('**/plugins/org.eclipse.equinox.launcher_*.jar', {cwd: server_home});
    if (launchersFound.length) {
        params.push('-jar');
        params.push(path.resolve(server_home, launchersFound[0]));
    } else {
        throw new Error(`Missing org.eclipse.equinox.launcher from path ${server_home}`);
    }

    let configDir = 'config_win';
    if (process.platform === 'darwin') {
        configDir = 'config_mac';
    } else if (process.platform === 'linux') {
        configDir = 'config_linux';
    }
    params.push('-configuration');
    params.push(path.join(server_home, configDir));
    params.push('-data');
    params.push(workspacePath);
    process.chdir(path.dirname(javaexe));
    let env = Object.create(process.env);
    env.CLIENT_PORT = '3333';
    const _process = new BufferedIOProcess({
        env,
        command: 'java',
        args: params,
        stdout: (data) => {
            if (data[0] == '*')
                outputFunc(data.substr(1), 'stdout');
            else {
                try {
                    const json = JSON.parse(data);
                    console.log(JSON.stringify(json));
                }
                catch (error) {
                    console.log("!" + data);
                }
            }
        },
        stderr: (data) => {
            outputFunc(data, 'stderr');
        },
        exit: (code) => {
            exitCode = code;
            if (code === 0) {
                outputFunc(`java.exe exited.`, 'stdout');
            }
            else outputFunc(`java.exe exited with error code ${code}.`, 'stderr');
        }
    });
    await _process.spawn();
}