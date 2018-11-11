'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const handlebars = require('handlebars');
const create = require('..');
let engine;

describe('engine-handlebars', () => {
  beforeEach(() => {
    engine = create(handlebars);
  });

  describe('.Handlebars', () => {
    it('should expose the engine.', () => {
      let hbs = engine.instance;
      assert(hbs.hasOwnProperty('compile'));
      assert(hbs.hasOwnProperty('SafeString'));
    });

    it('should allow helpers to be registered with the engine.', () => {
      let hbs = engine.instance;

      hbs.registerHelper('lower', function(str) {
        return str.toLowerCase();
      });

      let ctx = { name: 'Jon Schlinkert' };
      let file = { contents: Buffer.from('{{lower name}}') };

      return engine.render(file, ctx)
        .then(file => {
          assert.equal(file.contents.toString(), 'jon schlinkert');
        });
    });
  });

  describe('.compile()', () => {
    it('should compile a template.', async () => {
      let file = { contents: 'Jon {{ name }}' };
      let { fn } = await engine.compile(file);
      assert.equal(typeof fn, 'function');
    });

    it('should render a template with a compiled function.', async () => {
      let { fn } = await engine.compile({ contents: 'Jon {{ name }}' });
      assert.equal(typeof fn, 'function');
      assert.equal(fn({ name: 'Schlinkert' }), 'Jon Schlinkert');
    });

    it('should immediately return an already compiled function.', async () => {
      let file = await engine.compile({ contents: 'Jon {{ name }}' });
      let { fn } = await engine.compile(file);
      assert.equal(typeof fn, 'function');
      assert.equal(fn, file.fn);
      assert.equal(fn({ name: 'Schlinkert' }), 'Jon Schlinkert');
    });
  });

  describe('.render()', () => {
    it('should render templates in a string:', () => {
      let ctx = { name: 'Jon Schlinkert' };
      return engine.render({ contents: '{{ name }}' }, ctx)
        .then(file => {
          assert.equal(file.contents.toString(), 'Jon Schlinkert');
        });
    });

    it('should render templates from a compiled function:', async() => {
      let { fn } = await engine.compile({ contents: '{{ name }}' });
      let str = fn({ name: 'Jon Schlinkert' });
      assert.equal(str, 'Jon Schlinkert');
    });

    it('should work with no context:', async() => {
      let file = await engine.compile('foo');
      assert.equal(file.fn(), 'foo');
    });

    it('should handle engine errors:', function(cb) {
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

    it('should use helpers passed on the options.', () => {
      let ctx = {
        name: 'Jon Schlinkert',
        helpers: {
          include(name) {
            let filepath = path.join('test/fixtures', name);
            return fs.readFileSync(filepath, 'utf8');
          },
          upper(str) {
            return str.toUpperCase();
          }
        }
      };

      return engine.render('{{upper (include "content.hbs")}}', ctx)
        .then(file => {
          assert.equal(file.contents.toString(), 'JON SCHLINKERT');
        });
    });

    it('should use partials passed on the options.', () => {
      let ctx = { partials: { a: 'foo', b: 'bar' } };

      return engine.render('{{> a }}{{> b }}', ctx)
        .then(file => {
          assert.equal(file.contents.toString(), 'foobar');
        });
    });
  });

  describe('.renderSync()', () => {
    it('should render a template.', () => {
      let file = engine.renderSync('Jon {{ name }}', { name: 'Schlinkert' });
      assert.equal(file.contents.toString(), 'Jon Schlinkert');
    });

    it('should render a template from a compiled function.', () => {
      let file = engine.compileSync('Jon {{ name }}');
      engine.renderSync(file, { name: 'Schlinkert' });
      assert.equal(file.contents.toString(), 'Jon Schlinkert');
    });

    it('should throw engine errors:', () => {
      try {
        engine.renderSync('{{foo}}}');
      } catch (err) {
        assert(err);
        assert.equal(typeof err, 'object');
        assert(/Parse error/.test(err.message));
      }
    });
  });
});
