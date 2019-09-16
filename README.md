WP Themes Gulp
===============

Common gulp tasks for compiling assets for WP themes.

Example usage in `gulpfile.js`:

```js
const wpThemesGulp = require('wp-themes-gulp');

const gulpTasks = wpThemesGulp({
  root: '../',
  source: {
    root: '/src/',
    scss: '/scss/',
    js: '/js/',
    libs: [
      '/node_modules/anylib/dist/anylib.min.js'
    ]
  },
  build: {
    root: '/assets/',
    css: '/css/',
    js: '/js/'
  }
});

module.exports = gulpTasks;
```