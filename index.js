'use strict';

/**
 * Module dependencies.
 */

var fs = require('fs');
var extend = require('extend-shallow');
var utils = require('engine-utils');

/**
 * Requires cache
 */

var requires = {};

/**
 * Handlebars support.
 */

var engine = module.exports = utils.fromStringRenderer('handlebars');

/**
 * Engine options
 */

engine.options = {
  src: {ext: '.hbs'},
  dest: {ext: '.html'}
};

/**
 * Expose `Handlebars`, to give users access to the same instance
 */

engine.Handlebars = requires.Handlebars || (requires.Handlebars = require('handlebars'));

/**
 * Handlebars string support. Compile the given `str` and register
 * helpers and partials from settings
 *
 * ```js
 * var engine = require('engine-handlebars');
 * var fn = engine.compile('{{name}}', {});
 * ```
 * @param {String} `str` String or compiled function.
 * @param {Object} `options` object containing optional helpers and partials
 * @api public
 */

engine.compile = function compile(str, options) {
  var handlebars = this.Handlebars;
  options = options || {};

  initAsyncHelpers(this);

  for (var partial in options.partials) {
    handlebars.registerPartial(partial, options.partials[partial]);
  }
  for (var helper in options.helpers) {
    handlebars.registerHelper(helper, options.helpers[helper]);
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
 * @param {String|Function} `str` String or compiled function.
 * @param {Object|Function} `locals` or callback.
 * @param {Function} `cb` callback function.
 * @api public
 */

engine.render = function render(str, locals, cb) {
  if (typeof locals === 'function') {
    cb = locals;
    locals = {};
  }
  try {
    var fn = typeof str !== 'function'
      ? engine.compile(str, locals)
      : str;

    cb(null, fn(locals));
  } catch (err) {
    cb(err);
    return;
  }
};

/**
 * [Vinyl][] file support. Render tempates in the `contents`
 * of the given `file` and invoke the callback `cb(err, file)`.
 * If the file has a `data` object, it will be merged with
 * locals and passed to templates as context. `data` wins over
 * `locals`.
 *
 * ```js
 * var engine = require('engine-handlebars');
 * var file = new File({
 *   path: 'foo.hbs',
 *   contents: new Buffer('{{name}}')
 * });
 * engine.renderFile(file, {name: 'Foo'}, function (err, res) {
 *   console.log(res.contents.toString())
 *   //=> 'Foo'
 * });
 * ```
 * @param {Object} `file` Vinyl file.
 * @param {Object|Function} `locals` or callback.
 * @param {Function} `cb` callback function.
 * @api public
 */

engine.renderFile = function renderFile(file, locals, cb) {
  if (typeof locals === 'function') {
    cb = locals;
    locals = {};
  }

  if (typeof file !== 'object' || (!file._isVinyl && !file.isView)) {
    return cb(new Error('expected a vinyl file.'));
  }

  var str = typeof file.fn !== 'function'
    ? file.contents.toString()
    : file.fn;

  var ctx = extend({}, locals, file.data);
  engine.render(str, ctx, function(err, res) {
    if (err) return cb(err);

    file.contents = new Buffer(res);
    cb(null, file);
  });
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
 * @param  {Object} `locals`
 * @return {String} Rendered string.
 * @api public
 */

engine.renderSync = function renderSync(str, options) {
  options = options || {};
  try {
    var fn = (typeof str === 'function' ? str : engine.compile(str, options));
    return fn(options);
  } catch (err) {
    return err;
  }
};

/**
 * Async helper/partial handling specific to Handlebars
 */

function initAsyncHelpers(engine) {
  if (typeof engine.asyncHelpers === 'undefined') {
    return;
  }
  var handlebars = engine.Handlebars;
  var asyncHelpers = engine.asyncHelpers;

  if (typeof handlebars.helpers._invokePartial === 'function'
    && typeof asyncHelpers.helpers._invokePartial === 'function') {
    return;
  }

  var invokePartial = handlebars.VM.invokePartial;
  handlebars.VM.invokePartial = function(partial, context, options) {
    var name = options.name;
    if (asyncHelpers.hasAsyncId(name)) {
      // create inline helper to invoke the partial when the helper is ready
      return handlebars.helpers._invokePartial.apply(this, arguments);
    }
    // return 'foo';
    return invokePartial.apply(handlebars.VM, arguments);
  };

  /**
   * `invokePartialWrapper` is mostly from Handlebars/runtime#invokePartialWrapper
   * It's used here because the method is created inside a closure and inaccessible to outside code.
   */

  function invokePartialWrapper(partial, context, options) {
    if (options.hash) {
      context = extend({}, context, options.hash);
      if (options.ids) {
        options.ids[0] = true;
      }
    }

    partial = handlebars.VM.resolvePartial.call(handlebars.VM, partial, context, options);
    var result = handlebars.VM.invokePartial.call(handlebars.VM, partial, context, options);

    if (result == null && handlebars.compile) {
      options.partials[options.name] = handlebars.compile(partial, options);
      result = options.partials[options.name](context, options);
    }

    if (result != null) {
      if (options.indent) {
        let lines = result.split('\n');
        for (let i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = options.indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    }

    throw new Error('The partial ' + options.name + ' could not be compiled when running in runtime-only mode');
  }

  /**
   * Internal helper that will be used to resolve async helper ids when used with dynamic partials.
   */

  function _invokePartial(partial, context, options, cb) {
    var id = options.name;
    asyncHelpers.resolveIds(id, function(err, name) {
      if (err) return cb(err);
      options.name = name;
      var res = '';
      try {
        res = invokePartialWrapper(partial, context, options);
      } catch (err) {
        cb(err);
        return;
      }
      cb(null, res);
    });
  }

  _invokePartial.async = true;
  asyncHelpers.set('_invokePartial', _invokePartial);
  handlebars.registerHelper('_invokePartial', asyncHelpers.get('_invokePartial', {wrap: true}));
}

/**
 * Express support.
 */

engine.__express = function(fp, locals, cb) {
  engine.render(fs.readFileSync(fp, 'utf8'), locals, cb);
};
