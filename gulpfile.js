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
    //.pipe(sourcemaps.init())
    .pipe(babel(babelOpts))
    //.pipe(sourcemaps.write('.', { sourceRoot: '../src' }))
    .pipe(gulp.dest('out'));
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

gulp.task('clean', (callback) => {
  return del([
    'dist/**/*'
  ], callback);
});

gulp.task('compile-hello', () => {
  return gulp.src('./test_data/hello/**/*.java')
    .pipe(javac('hello.jar'))
    .pipe(gulp.dest('./dist/test_data/bin'));
});

gulp.task('link-test-source', () => {
  mkdirp.sync('./dist/debug-server/src');
  return symlinkDir('./test', './dist/debug-server/src/test');
});
gulp.task('link-java-source', () => {
  mkdirp.sync('./dist/debug-server/src/main/java');
  return symlinkDir(path.join(config["jdt.ls.folder"], '/org.eclipse.jdt.ls.debug/src/org'), './dist/debug-server/src/main/java/org');
});

gulp.task('copy-gradle', () => {
  return gulp.src('./gradle_bundles/**/*')
    .pipe(gulp.dest('./dist/debug-server'));
});

gulp.task('clone-java-source', (callback) => {
  if (checkLocalGIT()) {
    gutil.log('ignore jdt.ls source clone because the source is cloned already.')
    callback(null);
  } else {
    git.clone(config['jdt.ls.git'], { args: config["jdt.ls.folder"] }, callback);
  }
});

gulp.task('gradle-eclipse', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/prepare-eclipse-workspace').default({
      cwd: path.join(__dirname, './dist/debug-server').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });

gulp.task('gradle-build', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/build').default({
      cwd: path.join(__dirname, './dist/debug-server').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });

gulp.task('gradle-test', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/test').default({
      cwd: path.join(__dirname, './dist/debug-server').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });

gulp.task('gradle-checkstyle', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/checkstyle').default({
      cwd: path.join(__dirname, './dist/debug-server').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });


gulp.task('dev', (callback) => {
  runSequence('babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-eclipse',    
    callback);
});

gulp.task('build', (callback) => {
  runSequence('babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-build',
    callback);
});

gulp.task('unittest', (callback) => {
  runSequence('babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-eclipse',
    'gradle-checkstyle',
    'gradle-test',
    callback);
});


gulp.task('checkstyle', (callback) => {
  runSequence('babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-checkstyle',
    callback);
});


gulp.task('clean_server', (callback) => {
    return del([
        'server/**/*'
    ], callback);
});


function isWin() {
    return /^win/.test(process.platform);
}

function isMac() {
    return /^darwin/.test(process.platform);
}

function isLinux() {
    return /^linux/.test(process.platform);
}

function mvnw() {
    return isWin()?"mvnw.cmd":"./mvnw";
}

const server_dir = '../eclipse.jdt.ls';
gulp.task('build_server', ['clean_server'], () => {
    cp.execSync(mvnw()+ ' -Pserver-distro clean package ', {cwd:server_dir, stdio:[0,1,2]} );
    return gulp.src(server_dir + '/org.eclipse.jdt.ls.product/distro/*.tar.gz')
        .pipe(decompress())
        .pipe(gulp.dest('./server'));
});

