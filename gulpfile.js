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

const readThrough = function () {
  return through.obj(function (file, enc, cb) {
    gutil.log('compiling', gutil.colors.blue(path.basename(file.path)));
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
  mkdirp.sync('./dist/org.eclipse.jdt.ls.debug.v2/src');
  return symlinkDir('./test', './dist/org.eclipse.jdt.ls.debug.v2/src/test');
});
gulp.task('link-java-source', () => {
  mkdirp.sync('./dist/org.eclipse.jdt.ls.debug.v2/src/main/java');
  return symlinkDir(path.join(config["jdt.ls.folder"], '/org.eclipse.jdt.ls.debug/src/org'), './dist/org.eclipse.jdt.ls.debug.v2/src/main/java/org');
});

gulp.task('copy-gradle', () => {
  return gulp.src('./gradle_bundles/**/*')
    .pipe(gulp.dest('./dist/org.eclipse.jdt.ls.debug.v2'));
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
      cwd: path.join(__dirname, './dist/org.eclipse.jdt.ls.debug.v2').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });

gulp.task('gradle-build', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/build').default({
      cwd: path.join(__dirname, './dist/org.eclipse.jdt.ls.debug.v2').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });

gulp.task('gradle-test', ['link-java-source',
  'copy-gradle'], () => {
    return require('./out/test').default({
      cwd: path.join(__dirname, './dist/org.eclipse.jdt.ls.debug.v2').replace(/\\/g, '/'),
      lib: path.join(__dirname, './lib').replace(/\\/g, '/'),
      jdk_source: path.join(__dirname, './lib/jdk8u-jdi.zip').replace(/\\/g, '/')
    });
  });



gulp.task('dev', (callback) => {
  runSequence('clean', 'babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-eclipse',    
    callback);
});

gulp.task('build', (callback) => {
  runSequence('clean', 'babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-build',
    callback);
});

gulp.task('test', (callback) => {
  runSequence('clean', 'babel',  'clone-java-source', 'link-test-source', [
    'link-java-source',
    'copy-gradle'],
    'gradle-test',
    callback);
});