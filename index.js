const { src, dest, parallel, series, watch } = require('gulp');
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

  const Settings = Object.assign({
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

  const Files = {};

  Files.style = path.join(dirname, Settings.themeRoot, Settings.src.scss, 'style.scss');
  Files.scss = [
    path.join(dirname, Settings.themeRoot, Settings.src.scss, '*.scss'),
    '!' + path.join(dirname, Settings.themeRoot, Settings.src.scss, '_*.scss'),
    '!' + Files.style
  ];
  Files.php = path.join(dirname, Settings.themeRoot, '/**/*.php');
  Files.js = path.join(dirname, Settings.themeRoot, Settings.src.js, '*.js');
  Files.libs = Settings.libs.length ? Settings.libs.map(lib => path.join(dirname, lib)) : false;

  const styleTask = () => {
    const conn = getFtpConnection();

    return src(Files.style)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
      .pipe(dest(path.join(dirname, Settings.themeRoot)));
  };

  const scssTask = parallel(styleTask, () => {
    const conn = getFtpConnection();

    return vinylfs.src(Files.scss)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(path.join(ftpRemoteDir, Settings.dest.css)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, Settings.dest.css)) : through.obj())
      .pipe(dest(path.join(dirname, Settings.themeRoot, Settings.dest.css)));
  });

  const jsTask = () => {
    const conn = getFtpConnection();

    return src(Files.js)
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
      .pipe(Files.libs ? addsrc.append(Files.libs) : through.obj())
      .pipe(gulpif(file => {
        return file.contents.toString().split(/\r\n|\r|\n/).length > 20 && !argv.dev;
      }, uglify({
        output: {
          comments: saveLicense
        }
      })))
      .pipe(concat('main.js'))
      .pipe(hasFtp() ? conn.newer(path.join(ftpRemoteDir, Settings.dest.js)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, Settings.dest.js)) : through.obj())
      .pipe(dest(path.join(dirname, Settings.themeRoot, Settings.dest.js)));
  };

  const phpTask = () => {
    const conn = getFtpConnection();

    return src(Files.php)
      .pipe(hasFtp() ? conn.newer(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
  };

  const defaultTask = parallel(scssTask, jsTask, phpTask);

  const watchTask = series(defaultTask, () => {
    const watch_scss = glob.sync(Files.scss[0]);
    const watch_js = glob.sync(Files.js);
    const watch_php = glob.sync(Files.php);

    if (argv.scss || (!argv.scss && !argv.js && !argv.php)) watch(watch_scss, scssTask);
    if (argv.js || (!argv.scss && !argv.js && !argv.php)) watch(watch_js, jsTask);
    if (argv.php || (!argv.scss && !argv.js && !argv.php)) watch(watch_php, phpTask);
  });

  return {
    scss: scssTask,
    js: jsTask,
    php: phpTask,
    watch: watchTask,
    default: defaultTask
  };
};