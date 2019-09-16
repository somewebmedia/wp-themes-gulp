WP Themes Gulp
===============

Common gulp tasks for compiling assets for WP themes.

Example usage in `gulpfile.js`:

```js
const wpThemesGulp = require('wp-themes-gulp');

const gulpTasks = wpThemesGulp({
  themeRoot: '../',
  src: {
    scss: '/src/scss/',
    js: '/src/js/'
  },
  dest: {
    css: '/assets/css/',
    js: '/assets/js/'
  },
  libs: [
    '/node_modules/anylib/dist/anylib.min.js'
  ]
});

module.exports = gulpTasks;
```