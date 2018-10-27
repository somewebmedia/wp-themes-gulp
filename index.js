const gulp = require('gulp');
const glob = require('glob');
const path = require('path');
const through = require('through2');
const babel = require('gulp-babel');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const uglify = require('gulp-uglify');
const addsrc = require('gulp-add-src');
const concat = require('gulp-concat');
const gulpif = require('gulp-if');
const saveLicense = require('uglify-save-license');
const vinylfs = require('vinyl-fs');
const ftp = require('vinyl-ftp');
const argv = require('yargs').argv;

// current working dir
const dirname = process.cwd();

// ftp
const ftpUser = process.env.FTP_USER;
const ftpPassword = process.env.FTP_PWD;
const ftpHost = process.env.FTP_HOST;
const ftpPort = process.env.FTP_PORT || 21;
const ftpRemoteDir = process.env.FTP_DIR || '/';

function getFtpConnection() {
  return ftp.create({
    host: ftpHost,
    port: ftpPort,
    user: ftpUser,
    password: ftpPassword,
    log: console.log
  });
}

function hasFtp() {
  return ftpUser && ftpPassword && ftpHost;
}

module.exports = (config) => {
  const settings = Object.assign({
    themeRoot: '../',
    src: {
      scss: '/src/scss/',
      js: '/src/js/'
    },
    dest: {
      css: '/assets/css/',
      js: '/assets/js/'
    },
    libs: []
  }, config);

  const STYLE = path.join(dirname, settings.themeRoot, settings.src.scss, 'style.scss');
  const SCSS = [
    path.join(dirname, settings.themeRoot, settings.src.scss, '*.scss'),
    '!' + path.join(dirname, settings.themeRoot, settings.src.scss, '_*.scss'),
    '!' + STYLE
  ];
  const PHP = path.join(dirname, settings.themeRoot, '/**/*.php');
  const JS = path.join(dirname, settings.themeRoot, settings.src.js, '*.js');
  const JS_LIBS = settings.libs.length ? settings.libs.map(lib => path.join(dirname, lib)) : false;

  gulp.task('style', () => {
    const conn = getFtpConnection();

    return gulp.src(STYLE)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
      .pipe(gulp.dest(path.join(dirname, settings.themeRoot)));
  });

  gulp.task('scss', ['style'], () => {
    const conn = getFtpConnection();

    return vinylfs.src(SCSS)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(path.join(ftpRemoteDir, settings.dest.css)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, settings.dest.css)) : through.obj())
      .pipe(gulp.dest(path.join(dirname, settings.themeRoot, settings.dest.css)));
  });

  gulp.task('js', () => {
    const conn = getFtpConnection();

    return gulp.src(JS)
      .pipe(babel(
        {
          presets: [
            [
              '@babel/preset-env',
              {
                modules: false
              }
            ]
          ]
        }
      ))
      .pipe(JS_LIBS ? addsrc.append(JS_LIBS) : through.obj())
      .pipe(gulpif(file => {
        return file.contents.toString().split(/\r\n|\r|\n/).length > 20 && !argv.dev;
      }, uglify({
        output: {
          comments: saveLicense
        }
      })))
      .pipe(concat('main.js'))
      .pipe(hasFtp() ? conn.newer(path.join(ftpRemoteDir, settings.dest.js)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, settings.dest.js)) : through.obj())
      .pipe(gulp.dest(path.join(dirname, settings.themeRoot, settings.dest.js)));
  });

  gulp.task('php', () => {
    const conn = getFtpConnection();

    return gulp.src(PHP)
      .pipe(hasFtp() ? conn.newer(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
  });

  gulp.task('default', ['scss', 'js', 'php'], () => {});

  gulp.task('watch', ['default'], () => {
    const watch_scss = glob.sync(SCSS[0]);
    const watch_js = glob.sync(JS);
    const watch_php = glob.sync(PHP);

    if (argv.scss || (!argv.scss && !argv.js && !argv.php)) gulp.watch(watch_scss, ['scss']);
    if (argv.js || (!argv.scss && !argv.js && !argv.php)) gulp.watch(watch_js, ['js']);
    if (argv.php || (!argv.scss && !argv.js && !argv.php)) gulp.watch(watch_php, ['php']);
  });
};