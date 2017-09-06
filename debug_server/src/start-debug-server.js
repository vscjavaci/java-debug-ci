import fs from 'fs-plus';
import path from 'path';
import glob from 'glob';
import mkdirp from 'mkdirp';
import BufferedIOProcess from './bufferred-io-process';
import { startDebugServer } from './debug-server'
const config = require('../config.json');
let lsStarted = false;
let lsprocess;
let location =   path.join(__dirname, '..', 'server');
const workspaceRoot = path.join(__dirname, '..', 'workspace');
mkdirp.sync(workspaceRoot);

async function resolveJdkPath() {
    const isWindows = (process.platform === "win32");
    const isMacintosh = (process.platform === "darwin");
    const isLinux = (process.platform === "linux");
    if (isWindows) {
        const WinReg = require("winreg");
        function getRegistryValues(hive, key, name) {
            return new Promise((resolve, reject) => {
                try {
                    const regKey = new WinReg({
                        hive,
                        key,
                    });

                    regKey.valueExists(name, (e, exists) => {
                        if (e) {
                            return reject(e);
                        }
                        if (exists) {
                            regKey.get(name, (err, result) => {
                                if (!err) {
                                    resolve(result ? result.value : "");
                                } else {
                                    reject(err);
                                }
                            });
                        } else {
                            resolve("");
                        }
                    });
                } catch (ex) {
                    reject(ex);
                }
            });
        }
        let currentVersion = await getRegistryValues(WinReg.HKLM,
            "\\SOFTWARE\\JavaSoft\\Java Development Kit",
            "CurrentVersion");
        let WOW6432Node = false;
        if (!currentVersion) {
            currentVersion = await getRegistryValues(WinReg.HKLM,
                "\\SOFTWARE\\WOW6432Node\\JavaSoft\\Java Development Kit",
                "CurrentVersion");
            WOW6432Node = true;
        }
        let pathString = "";
        if (currentVersion) {
            pathString = await getRegistryValues(WinReg.HKLM,
                (WOW6432Node? "\\SOFTWARE\\WOW6432Node\\JavaSoft\\Java Development Kit\\" : "\\SOFTWARE\\JavaSoft\\Java Development Kit\\") + currentVersion,
                "JavaHome");
        }

        if (fs.isDirectorySync(pathString)) {
            return pathString;
        }
        try {
            pathString = childProcess.execSync("where java", { encoding: "utf8" });
        } catch (error) {
            // when "where java"" execution fails, the childProcess.execSync will throw error, just ignore it
            console.log(error);
            return "";
        }
        pathString = pathString.trim().split('\n')[0].trim();
        pathString = path.resolve(pathString);
        if (fs.isFileSync(pathString)) {
            // C:\Program Files\Java\jdk1.8.0_131\bin\java.exe => C:\Program Files\Java\jdk1.8.0_131
            pathString = path.dirname(path.dirname(path.resolve(pathString)));
        }

        return pathString;
    } else if (isMacintosh || isLinux) {
        return new Promise((resolve, reject) => {
            require('find-java-home')(function(err, home){
                if(err) reject(err);
                else resolve(home);
            });
        });

    }

}

export default async function execute()  {
    const jdkHome = await resolveJdkPath();
    console.log('resolved java home:', jdkHome);

    const javaexe = path.join(jdkHome, 'bin', (process.platform === "win32") ? 'java.exe': 'java');
    if (!fs.isFileSync(javaexe)) {
        throw new Error(`Missing java.exe from path ${jdkHome}`);
    }
    console.log('resolved java executive:', javaexe);

    if (!fs.isDirectorySync(location)) {
        throw new Error(`Cannot find language server root: ${location}`);
    }

    console.log('working on language server:', location);
    
    const projectRoot = path.normalize(path.join(__dirname, '..', config['project_root']));
    if (!fs.isDirectorySync(projectRoot)) {
        throw new Error(`Cannot find project root: ${projectRoot}`);
    }


    console.log('working on java project:', projectRoot);
    const promise1 = startDebugServer(projectRoot);

    let exitCode = -1;
    const outputFunc = (data, cat) => {
        if (cat === 'stderr') {
            console.error(data);
        } else {
            console.log('*' + data);
        }
    };
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
    params.push(workspaceRoot);
    // goto path of javaexe to avoid space issue in javaexe
    process.chdir(path.dirname(javaexe));


    // give an env variable about the socket server for lauguange server
    let env = Object.create(process.env);
    env.CLIENT_PORT = config['jdt.ls.connect_to_port'].toString();
    lsprocess = new BufferedIOProcess({
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
            lsStarted = false;
            exitCode = code;
            if (code === 0) {
                outputFunc(`java.exe exited.`, 'stdout');
            }
            else outputFunc(`java.exe exited with error code ${code}.`, 'stderr');

        }
    });
    lsStarted = true;
    await lsprocess.spawn();
};

// execute().catch(ex => console.log(ex));