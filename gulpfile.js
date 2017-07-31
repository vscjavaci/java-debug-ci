const fs = require('fs');
const fsp = require('fs-plus');
const glob = require('glob')
const path = require('path');
const gulp = require('gulp');
const gutil = require('gulp-util');
const mkdirp = require('mkdirp')

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
const git = require('gulp-git');
const del = require('del');
const config = require('./config.json');
const symlinkDir = require('symlink-dir');



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

const checkLocalJdkGIT = () => {
  if (fsp.isDirectorySync(path.join(__dirname, config["jdk.source.folder"]))) {
    if (fsp.isFileSync(path.join(__dirname, config["jdk.source.folder"], 'src/share/classes/com/sun/jdi/VirtualMachine.java'))) {
      return true;
    } else {
      throw new Error(`Invalid jdk folder ${path.join(__dirname, config["jdk.source.folder"])}, missing src/share/classes/com/sun/jdi/VirtualMachine.java`);
    }
  }
  else return false;
};

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

gulp.task('link-java-source', () => {
  mkdirp.sync('./dist/org.eclipse.jdt.ls.debug/src/java/main');
  return symlinkDir('../eclipse.jdt.ls/org.eclipse.jdt.ls.debug/src/org', './dist/org.eclipse.jdt.ls.debug/src/java/main/org');
});

gulp.task('copy-gradle', () => {
  return gulp.src('./gradle_bundles/**/*')
    .pipe(gulp.dest('./dist/org.eclipse.jdt.ls.debug'));
});

gulp.task('clone-jdk-source', (callback) => {
  if (checkLocalJdkGIT()) {
    gutil.log('ignore jdk source clone because the source is cloned already.')
    callback(null);
  } else {
    git.clone(config['jdk.source.git'], { args: config["jdk.source.folder"] }, callback);
  }
});

gulp.task('gradle-eclipse', ['link-java-source',
  'copy-gradle'], () => {
    require('./out/prepare-eclipse-workspace').default({
      cwd: path.join(__dirname, './dist/org.eclipse.jdt.ls.debug'),
      lib: path.join(__dirname, './lib'),
      jdk_source: path.join(__dirname, config["jdk.source.folder"])
    });
  })

gulp.task('dev', (callback) => {
  runSequence('clean', 'babel', [
    'clone-jdk-source',
    'link-java-source',
    'copy-gradle'],
    'gradle-eclipse',    
    callback);
});