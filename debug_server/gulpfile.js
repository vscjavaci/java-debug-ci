const fs = require('fs');
const fsp = require('fs-plus');
const glob = require('glob')
const path = require('path');
const gulp = require('gulp');
const gutil = require('gulp-util');
const mkdirp = require('mkdirp')

const git = require('gulp-git');

const through = require('through2');
const babel = require('gulp-babel');
const stripBom = require('remove-bom-buffer');
const changed = require('gulp-changed');
const sourcemaps = require('gulp-sourcemaps');
const babelOpts = require("babel-core/lib/transformation/file/options/build-config-chain")({ filename: __filename })[0].options;
const plumber = require('gulp-plumber');
const watch = require('gulp-watch');

const javac = require('gulp-javac');
const runSequence = require('run-sequence');
const del = require('del');
const config = require('./config.json');
const symlinkDir = require('symlink-dir');
const cp = require('child_process');
const decompress = require('gulp-decompress');



const checkLocalGIT = () => {
  if (fsp.isDirectorySync(path.join(__dirname, config["jdt.ls.folder"]))) {
    if (fsp.isFileSync(path.join(__dirname, config["jdt.ls.folder"], 'org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/debug/IDebugServer.java'))) {
      return true;
    } else {
      throw new Error(`Invalid jdk folder ${path.join(__dirname, config["jdt.ls.folder"])}, missing IDebugServer.java`);
    }
  }
  else return false;
};

let i = 1;
const readThrough = function () {
  return through.obj(function (file, enc, cb) {
    gutil.log('compiling', gutil.colors.blue(path.basename(file.path)), i++);
    file.base = path.join(file.base.substring(0, file.base.indexOf('src')), 'src');
    file.contents = stripBom(fs.readFileSync(file.path));
    this.push(file);
    cb();
  });
};

gulp.task('babel', () => {
  return gulp.src(['src/**/*.js', '!**/*jb_tmp*'], { cwd: '.', read: false })
    .pipe(plumber())
    .pipe(changed('out'))
    .pipe(readThrough())
    .pipe(sourcemaps.init())
    .pipe(babel(babelOpts))
    .pipe(sourcemaps.write('.', { sourceRoot: '../src' }))
    .pipe(gulp.dest('out'));
});


gulp.task('clean', ['clean_server'], callback => {
  return del([
    'out/**/*'
  ], callback);
});


const isWin = () => {
  return /^win/.test(process.platform);
};

const mvnw = () => {
  return isWin()?"mvnw.cmd":"./mvnw";
};

gulp.task('clean_server', callback => {
  return del([
      'server/**/*',
      'workspace/**/*',
  ], callback);
});

const server_dir = config['jdt.ls.folder'];

gulp.task('clone-java-source', (callback) => {
  if (checkLocalGIT()) {
    gutil.log('ignore jdt.ls source clone because the source is cloned already.')
    callback(null);
  } else {
    gutil.log(`git clone ${config['jdt.ls.git']}.`)
    git.clone(config['jdt.ls.git'], { args: server_dir }, callback);
  }
});


gulp.task('install', ['clean_server', 'clone-java-source'], () => {
    cp.execSync(mvnw()+ ' -Pserver-distro clean package ', {cwd:server_dir, stdio:[0,1,2]} );
    return gulp.src(server_dir + '/org.eclipse.jdt.ls.product/distro/*.tar.gz')
        .pipe(decompress())
        .pipe(gulp.dest('./server'));
});


gulp.task('start-debug-server', ['babel'], () => {
    return require('./out/start-debug-server').default(config.project_root);
});

gulp.task('start', ['babel'], (callback) => {
    const isServerInstalled = glob.sync('./server/plugins/org.eclipse.jdt.ls.debug*.jar').length > 0;
    if (!isServerInstalled) {
        runSequence('clone-java-source', 'install', 'start-debug-server', callback);
    } else {
        runSequence('start-debug-server', callback);
    }
});



gulp.task('watch', ['babel'], () => {
    return watch(['src/**/*.js', '!**/*jb_tmp*'], (change) => {
        return gulp.src(change.path, { cwd: __dirname, read: false })
            .pipe(plumber())
            .pipe(readThrough())
            .pipe(sourcemaps.init())
            .pipe(babel(babelOpts))
            .pipe(sourcemaps.write('.', { sourceRoot: '../src' }))
            .pipe(gulp.dest('out'));
    });
});