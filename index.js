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
    root: '../',
    source: {
      root: '/src/',
      scss: '/scss/',
      js: '/js/',
      libs: []
    },
    build: {
      root: '/assets/',
      css: '/css/',
      js: '/js/'
    },
    server: {
      root: ftpRemoteDir
    }
  }, config);

  const Files = {};

  Files.style = path.join(dirname, Settings.root, Settings.source.root, Settings.source.scss, 'style.scss');
  Files.scss = [
    path.join(dirname, Settings.root, Settings.source.root, Settings.source.scss, '*.scss'),
    '!' + path.join(dirname, Settings.root, Settings.source.root, Settings.source.scss, '_*.scss'),
    '!' + Files.style
  ];
  Files.php = path.join(dirname, Settings.root, '/**/*.php');
  Files.js = path.join(dirname, Settings.root, Settings.source.root, Settings.source.js, '*.js');
  Files.libs = Settings.source.libs.length ? Settings.source.libs.map(lib => path.join(dirname, Settings.root, Settings.source.root, lib)) : false;

  const compileMainStyle = () => {
    const conn = getFtpConnection();

    return src(Files.style)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
      .pipe(dest(path.join(dirname, Settings.root)));
  };

  const compileScss = () => {
    const conn = getFtpConnection();

    return vinylfs.src(Files.scss)
      .pipe(sass({
        'includePaths': ['node_modules'],
        'outputStyle': argv.dev ? 'development' : 'compressed'
      }).on('error', sass.logError))
      .pipe(autoprefixer())
      .pipe(hasFtp() ? conn.newerOrDifferentSize(path.join(ftpRemoteDir, Settings.build.root, Settings.build.css)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, Settings.build.root, Settings.build.css)) : through.obj())
      .pipe(dest(path.join(dirname, Settings.root, Settings.build.root, Settings.build.css)));
  };

  const scssTask = parallel(compileMainStyle, compileScss);

  const compileJs = () => {
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
      .pipe(hasFtp() ? conn.newer(path.join(ftpRemoteDir, Settings.build.root, Settings.build.js)) : through.obj())
      .pipe(hasFtp() ? conn.dest(path.join(ftpRemoteDir, Settings.build.root, Settings.build.js)) : through.obj())
      .pipe(dest(path.join(dirname, Settings.root, Settings.build.root, Settings.build.js)));
  };

  const phpTask = () => {
    const conn = getFtpConnection();

    return src(Files.php)
      .pipe(hasFtp() ? conn.newer(ftpRemoteDir) : through.obj())
      .pipe(hasFtp() ? conn.dest(ftpRemoteDir) : through.obj())
  };

  const defaultTask = parallel(scssTask, compileJs, phpTask);

  const watchFiles = () => {
    const watch_scss = glob.sync(Files.scss[0]);
    const watch_js = glob.sync(Files.js);
    const watch_php = glob.sync(Files.php);

    if (argv.scss || (!argv.scss && !argv.js && !argv.php)) watch(watch_scss, scssTask);
    if (argv.js || (!argv.scss && !argv.js && !argv.php)) watch(watch_js, compileJs);
    if (argv.php || (!argv.scss && !argv.js && !argv.php)) watch(watch_php, phpTask);
  };

  return {
    scss: scssTask,
    js: compileJs,
    php: phpTask,
    watch: series(defaultTask, watchFiles),
    default: defaultTask
  };
};