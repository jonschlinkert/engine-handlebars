'use strict';

/**
 * Module dependencies.
 */

var fs = require('fs');
var utils = require('engine-utils');


/**
 * Requires cache.
 */

var requires = {};

/**
 * Handlebars support.
 */

var engine = module.exports = utils.fromStringRenderer('handlebars');

/**
 * Handlebars string support. Compile the given `str` and register
 * helpers and partials from settings
 *
 * ```js
 * var engine = require('engine-handlebars');
 * var fn = engine.compile('{{name}}', {});
 * ```
 *
 * @param {String} `str`
 * @param {Object} `settings` object containing optional helpers and partials
 * @api public
 */

engine.compile = function compile(str, settings) {
  var handlebars = require.handlebars || (require.handlebars = require('handlebars'));
  settings = settings || {};
  for (var partial in settings.partials) {
    handlebars.registerPartial(partial, settings.partials[partial]);
  }
  for (var helper in settings.helpers) {
    handlebars.registerHelper(helper, settings.helpers[helper]);
  }
  if (typeof str === 'function') return str;
  return handlebars.compile(str);
};

/**
 * Handlebars string support. Render the given `str` and invoke
 * the callback `cb(err, str)`.
 *
 * ```js
 * var engine = require('engine-handlebars');
 * engine.render('{{name}}', {name: 'Jon'}, function (err, content) {
 *   console.log(content); //=> 'Jon'
 * });
 * ```
 *
 * @param {String|function} `str`
 * @param {Object|Function} `context` or callback.
 * @param {Function} `cb` callback function.
 * @api public
 */

engine.render = function render(str, context, cb) {
  var handlebars = requires.handlebars || (requires.handlebars = require('handlebars'));
  if (typeof context === 'function') {
    cb = context;
    context = {};
  }

  context = context || {};

  try {
    var fn = (typeof str === 'function' ? str : engine.compile(str, context));
    cb(null,  fn(context), '.html');
  } catch (err) {
    cb(err);
    return;
  }
};

/**
 * Synchronously render Handlebars templates.
 *
 * ```js
 * var engine = require('engine-handlebars');
 * engine.renderSync('<%= name %>', {name: 'Jon'});
 * //=> 'Jon'
 * ```
 * @param  {Object|Function} `str` The string to render or compiled function.
 * @param  {Object} `context`
 * @return {String} Rendered string.
 * @api public
 */

engine.renderSync = function renderSync(str, context) {
  var handlebars = requires.handlebars || (requires.handlebars = require('handlebars'));
  context = context || {};

  try {
    var fn = (typeof str === 'function' ? str : engine.compile(str, context));
    return fn(context);
  } catch (err) {
    return err;
  }
};

/**
 * Handlebars file support. Render a file at the given `path`
 * and callback `cb(err, str)`.
 *
 * ```js
 * var engine = require('engine-handlebars');
 * engine.renderSync('foo/bar/baz.tmpl', {name: 'Jon'});
 * //=> 'Jon'
 * ```
 *
 * @param {String} `path`
 * @param {Object|Function} `options` or callback function.
 * @param {Function} `cb` callback function
 * @api public
 */

engine.renderFile = function renderFile(path, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var opts = options || {};
  try {
    engine.render(fs.readFileSync(path, 'utf8'), opts, cb);
  } catch (err) {
    cb(err);
    return;
  }
};

/**
 * Express support.
 */

engine.__express = engine.renderFile;
