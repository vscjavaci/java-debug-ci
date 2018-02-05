import chai from 'chai'
import path from 'path'
import * as utils from './test-utils'
chai.should();
import { ROOT, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE } from './constants';
import fs from 'fs'
import { assert } from 'chai'
import { execSync } from 'child_process'
let petclinicpro;
let todopro;
describe('MultiRoot test', () => {
    let config;
    let DATA_ROOT;
    let debugEngine;
    const projectPath = path.join(ROOT, "25.multi-root");
    beforeEach(function () {
        config = new MultiRoot();
        petclinicpro = path.join(config.petclinicPath, '.project');
        todopro = path.join(config.todoPath, '.project');
        if (!fs.existsSync(projectPath)) {
            console.log("****", "Clone project");
            let downloadCmd = `cd ${ROOT}` + '&& mkdir 25.multi-root' + '&& cd 25.multi-root' + '&& git clone https://github.com/spring-projects/spring-petclinic.git';
            let downloadCmd1 = `cd ${projectPath}` + '&& git clone https://github.com/Microsoft/todo-app-java-on-azure.git';
            execSync(downloadCmd, { stdio: [0, 1, 2] });
            if (fs.existsSync(projectPath)) {
                execSync(downloadCmd1, { stdio: [0, 1, 2] });
            }
            console.log("****", "Clone finished");
        }
        assert(!(fs.existsSync(petclinicpro) || fs.existsSync(todopro)));
        this.timeout(1000 * 20);
        (async () => {
            debugEngine = await utils.createDebugEngine(config.petclinicPath, LANGUAGE_SERVER_ROOT, LANGUAGE_SERVER_WORKSPACE, config);
            debugEngine.close();

        })();

    });
    it('should pass MultiRoot test.', function () {
        this.timeout(1000 * 50);
        (async ()=>{
            console.log("MultiRoot test started");
        })();
        console.log("MultiRoot test started");
    });
});

class MultiRoot {

    get testName() {
        return 'multi-root';
    }

    get petclinicPath() {
        return path.join(ROOT, '25.multi-root/spring-petclinic');
    }

    get todoPath() {
        return path.join(ROOT, '25.multi-root/todo-app-java-on-azure');
    }

    get sourcePath() {
        return 'src/main/java';
    }

    get outputPath() {
        return 'target/classes';
    }

    withEngine(engine) {
        utils.timeout(1000 * 50);
        assert((fs.existsSync(petclinicpro) && fs.existsSync(todopro)));
        assert(this.data.length === 2);
        for (let result of this.data) {
            if (result.mainClass === "org.springframework.samples.petclinic.PetClinicApplication") {
                assert(result.projectName === "spring-petclinic");
            }
            if (result.mainClass === "com.microsoft.azure.sample.TodoApplication") {
                assert(result.projectName === "todo-app-java-on-azure");
            }
        }
        console.log("Test successfully");
    }
}


