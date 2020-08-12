'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const handlebars = require('handlebars');
const create = require('..');
let engine;

describe('engine-handlebars', () => {
  beforeEach(() => {
    engine = create(handlebars.create());
  });

  describe('engine', () => {
    it('should expose the engine.', () => {
      const hbs = engine.instance;
      assert(hbs.hasOwnProperty('compile'));
      assert(hbs.hasOwnProperty('SafeString'));
    });

    it('should register helpers directly on the instance', () => {
      assert(!engine.instance.helpers.hasOwnProperty('upper'));

      engine.instance.registerHelper('upper', str => str.toUpperCase());

      assert(engine.instance.helpers.hasOwnProperty('upper'));

      const ctx = { name: 'Jon Schlinkert' };

      return engine.render(Buffer.from('{{upper name}}'), ctx).then(file => {
        assert.equal(file.contents.toString(), 'JON SCHLINKERT');
      });
    });

    it('should register helpers using the engine.helper() method', () => {
      assert(!engine.instance.helpers.hasOwnProperty('upper'));

      engine.helper('upper', str => str.toUpperCase());

      assert(engine.instance.helpers.hasOwnProperty('upper'));

      const ctx = { name: 'Jon Schlinkert' };

      return engine.render(Buffer.from('{{upper name}}'), ctx).then(file => {
        assert.equal(file.contents.toString(), 'JON SCHLINKERT');
      });
    });

    it('should register helpers passed on options', () => {
      const options = { helpers: { upper: str => str.toUpperCase() } };

      const ctx = { name: 'Jon Schlinkert' };

      assert(!engine.instance.helpers.hasOwnProperty('upper'));

      return engine.render(Buffer.from('{{upper name}}'), ctx, options).then(file => {
        assert(engine.instance.helpers.hasOwnProperty('upper'));
        assert.equal(file.contents.toString(), 'JON SCHLINKERT');
      });
    });
  });

  describe('.compile()', () => {
    it('should add a noop function to files without contents', async () => {
      const file = { contents: undefined };
      const { fn } = await engine.compile(file);
      assert.equal(typeof fn, 'function');
      assert.equal(fn(), undefined);
    });

    it('should compile a template.', async () => {
      const file = { contents: 'Jon {{ name }}' };
      const { fn } = await engine.compile(file);
      assert.equal(typeof fn, 'function');
    });

    it('should render a template with a compiled function.', async () => {
      const { fn } = await engine.compile({ contents: 'Jon {{ name }}' });
      assert.equal(typeof fn, 'function');
      assert.equal(fn({ name: 'Schlinkert' }), 'Jon Schlinkert');
    });

    it('should render templates from a compiled function:', async () => {
      const { fn } = await engine.compile({ contents: '{{ name }}' });
      const str = fn({ name: 'Jon Schlinkert' });
      assert.equal(str, 'Jon Schlinkert');
    });

    it('should work with no context:', async () => {
      const file = await engine.compile('foo');
      assert.equal(file.fn(), 'foo');
    });

    it('should immediately return an already compiled function.', async () => {
      const file = await engine.compile({ contents: 'Jon {{ name }}' });
      const { fn } = await engine.compile(file);
      assert.equal(typeof fn, 'function');
      assert.equal(fn, file.fn);
      assert.equal(fn({ name: 'Schlinkert' }), 'Jon Schlinkert');
    });
  });

  describe('.render()', () => {
    it('should render templates in a string:', () => {
      const ctx = { name: 'Jon Schlinkert' };
      return engine.render({ contents: '{{ name }}' }, ctx).then(file => {
        assert.equal(file.contents.toString(), 'Jon Schlinkert');
      });
    });

    it('should render templates from a compiled function:', async () => {
      const file = { contents: '{{ name }}' };
      await engine.compile(file);
      const fn = file.fn;
      await engine.render(file, { name: 'Jon Schlinkert' });
      assert.equal(file.fn, fn);
      assert.equal(file.contents.toString(), 'Jon Schlinkert');
    });

    it('should work with no context:', async () => {
      const file = { contents: '{{ name }}' };
      await engine.compile(file);
      const fn = file.fn;
      await engine.render(file);
      assert.equal(file.fn, fn);
      assert.equal(file.contents.toString(), '');
    });

    it('should handle engine errors:', cb => {
      engine.render('{{foo}}}')
        .then(() => {
          cb(new Error('expected an error'));
        })
        .catch(err => {
          assert.equal(typeof err, 'object');
          assert(/Parse error/.test(err.message));
          cb();
        });
    });

    it('should use helpers passed on the options.', async () => {
      const ctx = {
        name: 'Jon Schlinkert',
        helpers: {
          include(name) {
            const filepath = path.join('test/fixtures', name);
            return fs.readFileSync(filepath, 'utf8');
          },
          upper(str) {
            return str.toUpperCase();
          }
        }
      };

      const file = await engine.render('{{upper (include "content.hbs")}}', ctx);
      assert.equal(file.contents.toString(), 'JON SCHLINKERT');
    });

    it('should use partials passed on the options.', () => {
      const ctx = { partials: { a: 'foo', b: 'bar' } };

      return engine.render('{{> a }}{{> b }}', ctx).then(file => {
        assert.equal(file.contents.toString(), 'foobar');
      });
    });
  });

  describe('.renderSync()', () => {
    it('should render a template.', () => {
      const file = engine.renderSync('Jon {{ name }}', { name: 'Schlinkert' });
      assert.equal(file.contents.toString(), 'Jon Schlinkert');
    });

    it('should render a template from a compiled function.', () => {
      const file = engine.compileSync('Jon {{ name }}');
      engine.renderSync(file, { name: 'Schlinkert' });
      assert.equal(file.contents.toString(), 'Jon Schlinkert');
    });

    it('should throw engine errors:', () => {
      assert.throws(() => engine.renderSync('{{foo}}}'), /Parse error/);
    });
  });
});
