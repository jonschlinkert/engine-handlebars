'use strict';

module.exports = instance => {
  if (instance === void 0) throw new Error('expected an instance of "handlebars"');
  const registered = Symbol('registered');
  const register = (app, options = {}) => {
    if (!app) app = { cache: {} };

    if (options.helpers) {
      instance.registerHelper(options.helpers);
    }

    if (options.partials) {
      instance.registerPartial(options.partials);
    }

    if (options.registerPartials === false) return;
    if (!instance[registered] && app.cache.partials) {
      instance[registered] = true;
      instance.registerPartial(app.cache.partials);
    }
  };

  /**
   * Engine
   */

  const engine = {
    name: 'handlebars',
    instance,

    /**
     * Compile `file.contents` with `handlebars.compile()`. Adds a compiled
     * `.fn()` property to the given `file`.
     *
     * ```js
     * engine.compile({ contents: 'Jon {{ name }}' })
     *   .then(file => {
     *     console.log(typeof file.fn) // 'function'
     *   });
     * ```
     * @name .compile
     * @param {Object} `file` File object with `contents` string or buffer.
     * @param {Object} `options` Options with partials and helpers.
     * @return {Promise}
     * @api public
     */

    async compile(file, options) {
      return engine.compileSync(file, options);
    },

    /**
     * Render `file.contents` with the function returned from `.compile()`.
     *
     * ```js
     * engine.render({ contents: 'Jon {{ name }}' }, { name: 'Schlinkert' })
     *   .then(file => {
     *     console.log(file.contents.toString()) // 'Jon Schlinkert'
     *   });
     * ```
     * @name .render
     * @param {Object} `file` File object with `contents` string or buffer.
     * @param {Object} `locals` Locals to use as contents to render the string.
     * @param {Object} `options` Options with partials and helpers.
     * @return {Promise}
     * @api public
     */

    async render(file, locals, options) {
      if (typeof file === 'string') file = { contents: Buffer.from(file) };
      let thisArg = this === engine ? { cache: {} } : this;
      let opts = { ...locals, ...options };
      register(thisArg, opts);

      // resolve dynamic partials
      if (opts.asyncHelpers === true && thisArg.ids) {
        let resolvePartial = instance.VM.resolvePartial.bind(instance.VM);
        instance.VM.resolvePartial = (name, context, options) => {
          let tok = this.ids.get(name);
          if (tok) {
            let opts = tok.options || {};
            let args = tok.args.concat(opts);
            name = tok.fn(...args);
          }
          return resolvePartial(name, context, options);
        };
      }

      let data = Object.assign({}, locals, file.data);
      data.file = file;
      data.app = this;

      if (!file.fn) await this.compile(file, opts);
      let res = await file.fn(data);
      let str = this.resolveIds ? await this.resolveIds(res) : res;
      file.contents = Buffer.from(str);
      return file;
    },

    /**
     * Compile `file.contents` with `handlebars.compile()`. Adds a compiled
     * `.fn()` property to the given `file`.
     *
     * ```js
     * let file = engine.compileSync({ contents: 'Jon {{ name }}' });
     * console.log(typeof file.fn) // 'function'
     * ```
     * @name .compileSync
     * @param {Object} `file` File object with `contents` string or buffer.
     * @param {Object} `options` Options with partials and helpers.
     * @return {Object} Returns the file object.
     * @api public
     */

    compileSync(file, options = {}) {
      if (typeof file === 'string') file = { contents: Buffer.from(file) };
      let { recompile, registerPartials } = options;

      if (typeof file.fn !== 'function' || recompile === true) {
        file.fn = instance.compile(file.contents.toString(), options);
      }

      if (registerPartials === false) return file;
      if (file.kind === 'partial' && !instance.partials[file.key]) {
        instance.registerPartial(file.key, file.fn);
      }
      return file;
    },

    /**
     * Render `file.contents` with the function returned from `.compile()`.
     *
     * ```js
     * let file = engine.renderSync({ contents: 'Jon {{ name }}' }, { name: 'Schlinkert' });
     * console.log(file.contents.toString()) // 'Jon Schlinkert'
     * ```
     * @name .renderSync
     * @param {Object} `file` File object with `contents` string or buffer.
     * @param {Object} `locals` Locals to use as contents to render the string.
     * @param {Object} `options` Options with partials and helpers.
     * @return {Object} Returns the file object.
     * @api public
     */

    renderSync(file, locals, options) {
      if (typeof file === 'string') file = { contents: Buffer.from(file) };
      let thisArg = this === engine ? { cache: {}, ids: new Map() } : this;
      let opts = { ...locals, ...options };
      register(thisArg, opts);

      let data = Object.assign({}, locals, file.data);
      data.file = file;
      data.app = this;

      if (!file.fn) this.compile(file, opts);
      file.contents = Buffer.from(file.fn(data));
      return file;
    }
  };

  return engine;
};
