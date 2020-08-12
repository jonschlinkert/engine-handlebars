'use strict';

const typeOf = require('kind-of');
const kRegistered = Symbol('registered');

module.exports = handlebars => {
  if (!handlebars) {
    try {
      handlebars = require('handlebars'); // lint-deps-disable-line
    } catch (err) { /* ignore */ }
  }

  if (handlebars === undefined) {
    throw new Error('expected an instance of "handlebars"');
  }

  /**
   * Engine
   */

  const engine = {
    name: 'handlebars',

    register(app, options = {}) {
      if (!app) app = {};
      if (!app.cache) app.cache = {};

      if (app.cache.helpers) engine.registerHelper(app.cache.helpers);
      if (options.helpers) engine.registerHelper(options.helpers);
      if (options.partials) engine.registerPartial(options.partials);

      if (options.registerPartials === false) return;
      if (app.cache.partials && !handlebars[kRegistered]) {
        handlebars[kRegistered] = true;
        engine.registerPartial(app.cache.partials);
      }
    },

    helper(...args) {
      handlebars.registerHelper(...args);
    },
    registerHelper(...args) {
      handlebars.registerHelper(...args);
    },

    partial(...args) {
      handlebars.registerPartial(...args);
    },
    registerPartial(...args) {
      handlebars.registerPartial(...args);
    },

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
      if (typeOf(file) !== 'object') file = { contents: Buffer.from(file) };

      if (!file.contents) {
        await this.compile(file, options);
        return file;
      }

      const thisArg = this === engine ? { cache: {} } : this;
      const opts = { ...locals, ...options };
      engine.register(thisArg, opts);

      // resolve dynamic partials
      if (opts.asyncHelpers === true && thisArg.ids) {
        const resolvePartial = handlebars.VM.resolvePartial.bind(handlebars.VM);
        handlebars.VM.resolvePartial = (name, context, options) => {
          const token = this.ids.get(name);
          if (token) {
            const opts = token.options || {};
            const args = token.args.concat(opts);
            name = token.fn(...args);
          }
          return resolvePartial(name, context, options);
        };
      }

      const data = { ...locals, ...file.data, file, app: this };

      if (!file.fn) await this.compile(file, opts);
      const res = await file.fn(data);
      const contents = this.resolveIds ? await this.resolveIds(res) : res;
      file.contents = Buffer.from(contents);
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
      if (typeOf(file) !== 'object') file = { contents: Buffer.from(file) };

      const { recompile, registerPartials } = options;

      if (!file.contents) {
        file.fn = () => file.contents;
      } else if (typeof file.fn !== 'function' || recompile === true) {
        file.fn = handlebars.compile(file.contents.toString(), options);
      }

      if (file.key && file.kind === 'partial' && registerPartials !== false) {
        handlebars.registerPartial(file.key, file.fn);
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
      if (typeOf(file) !== 'object') file = { contents: Buffer.from(file) };

      if (!file.contents) {
        this.compileSync(file, options);
        return file;
      }

      const thisArg = this === engine ? { cache: {}, ids: new Map() } : this;
      const opts = { ...locals, ...options };
      engine.register(thisArg, opts);

      const data = { ...locals, ...file.data, file, app: this };
      this.compile(file, opts);
      file.contents = Buffer.from(file.fn(data));
      return file;
    },

    set instance(value) {
      handlebars = value;
    },
    get instance() {
      return handlebars;
    }
  };

  return engine;
};
