'use strict';

var fs = require('fs');
var path = require('path');
var Vinyl = require('vinyl');
var assert = require('assert');
var EngineCache = require('engine-cache');
var engine = require('..');
var engines, hbs;

describe('engine-cache', function() {
  beforeEach(function() {
    engines = new EngineCache();
    engines.setEngine('hbs', engine);
    hbs = engines.getEngine('hbs');
  });

  describe('.Handlebars', function () {
    it('should expose the engine.', function () {
      var Handlebars = hbs.Handlebars;
      assert(Handlebars.hasOwnProperty('compile'))
      assert(Handlebars.hasOwnProperty('SafeString'))
    });

    it('should expose engine options.', function () {
      assert(hbs.options.src.ext === '.hbs');
      assert(hbs.options.dest.ext === '.html');
    });

    it('should allow helpers to registered with the engine.', function (done) {
      var Handlebars = hbs.Handlebars;
      Handlebars.registerHelper('blah', function (str) {
        return str.toLowerCase();
      });

      var ctx = {name: 'Halle Schlinkert'};

      hbs.render('{{blah name}}', ctx, function (err, content) {
        assert(content === 'halle schlinkert');
        done();
      });
    });
  });

  describe('.compile()', function () {
    it('should compile a template.', function () {
      var fn = hbs.compile('Halle {{ name }}');
      assert(typeof fn === 'function');
    });

    it('should render a template with a compiled function.', function () {
      var fn = hbs.compile('Halle {{ name }}');
      assert(typeof fn === 'function');
      assert(fn({name: 'Schlinkert'}) === 'Halle Schlinkert');
    });

    it('should immediately return an already compiled function.', function () {
      var compiled = hbs.compile('Halle {{ name }}');
      var fn = hbs.compile(compiled);
      assert(typeof fn === 'function');
      assert(fn({name: 'Schlinkert'}) === 'Halle Schlinkert');
    });

    it('should async render a template with a compiled function.', function (cb) {
      var fn = hbs.compile('Halle {{ name }}');
      assert.equal(typeof hbs.Handlebars.helpers._invokePartial, 'function');
      assert.equal(typeof hbs.asyncHelpers.helpers._invokePartial, 'function');
      assert.equal(typeof fn, 'function');
      fn({name: 'Schlinkert'}, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'Halle Schlinkert');
        cb();
      });
    });
  });


  describe('.render()', function() {
    it('should render templates in a string:', function(done) {
      var ctx = {name: 'Halle Schlinkert'};
      hbs.render('{{ name }}', ctx, function (err, content) {
        assert(content === 'Halle Schlinkert');
        done();
      });
    });

    it('should render templates from a compiled function:', function(done) {
      var ctx = {name: 'Halle Schlinkert'};
      var fn = hbs.compile('{{ name }}');
      hbs.render(fn, ctx, function (err, content) {
        assert(content === 'Halle Schlinkert');
        done();
      });
    });

    it('should handle async helpers and partials in templates from a string:', function(cb) {
      var ctx = {name: 'Halle Schlinkert'};
      var helpers = {
        upper: function(str, options, cb) {
          return cb(null, str.toUpperCase());
        },
        partial: function(name, options, cb) {
          return `partial_${name}`;
        }
      };
      helpers.upper.async = true;

      var partials = {
        PARTIAL_FOO: 'foo {{> (upper (partial "bar"))}} foo',
        PARTIAL_BAR: 'bar {{> (upper (partial "baz"))}} bar',
        PARTIAL_BAZ: 'baz {{name}} baz'
      };

      ctx.helpers = helpers;
      ctx.partials = partials;

      hbs.render('{{> (upper (partial "foo"))}}', ctx, function (err, content) {
        if (err) return cb(err);
        assert.equal(content, 'foo bar baz Halle Schlinkert baz bar foo');
        cb();
      });
    });

    it('should handle async helpers and partials in templates from a compiled function:', function(done) {
      var ctx = {name: 'Halle Schlinkert'};
      var fn = hbs.compile('{{ name }}');
      hbs.render(fn, ctx, function (err, content) {
        assert(content === 'Halle Schlinkert');
        done();
      });
    });

    it('should work with no context:', function(done) {
      var fn = hbs.compile('foo');
      hbs.render(fn, function (err, content) {
        assert(content === 'foo');
        done();
      });
    });

    it('should handle engine errors:', function(done) {
      hbs.render('{{foo}}}', function (err, content) {
        assert(err);
        assert(typeof err === 'object');
        assert(/Parse error/.test(err.message));
        done();
      });
    });

    it('should use helpers passed on the options.', function(done) {
      var ctx = {
        name: 'Halle Schlinkert',
        helpers: {
          include: function(name) {
            var filepath = path.join('test/fixtures', name);
            return fs.readFileSync(filepath, 'utf8');
          },
          upper: function(str) {
            return str.toUpperCase();
          }
        }
      };

      hbs.render('{{upper (include "content.hbs")}}', ctx, function (err, content) {
        if (err) return done(err);
        assert(content === 'JON SCHLINKERT');
        done();
      });
    });

    it('should use partials passed on the options.', function(done) {
      var ctx = {partials: {a: 'foo', b: 'bar'}};

      hbs.render('{{> a }}{{> b }}', ctx, function (err, content) {
        if (err) return done(err);
        assert(content === 'foobar');
        done();
      });
    });
  });

  describe('.renderSync()', function () {
    it('should render a template.', function () {
      var str = hbs.renderSync('Halle {{ name }}', {name: 'Schlinkert'});
      assert(str === 'Halle Schlinkert');
    });

    it('should render a template from a compiled function.', function () {
      var fn = hbs.compile('Halle {{ name }}');
      var str = hbs.renderSync(fn, {name: 'Schlinkert'});
      assert(str === 'Halle Schlinkert');
    });

    it('should throw engine errors:', function() {
      try {
        hbs.renderSync('{{foo}}}');
      } catch(err) {
        assert(err);
        assert(typeof err === 'object');
        assert(/Parse error/.test(err.message));
      }
    });
  });

  describe('express support', function() {
    it('should render templates from a file.', function(done) {
      var ctx = {name: 'Halle Schlinkert'};

      hbs.__express('test/fixtures/default.hbs', ctx, function (err, content) {
        assert(content === 'Halle Schlinkert');
        done();
      });
    });

    it('should work when the callback is the second arg', function(done) {
      hbs.__express('test/fixtures/content.hbs', function (err, content) {
        assert(content === 'Jon Schlinkert');
        done();
      });
    });

    it('should handle engine errors:', function(done) {
      hbs.__express('test/fixtures/bad.hbs', {}, function (err, content) {
        assert(err);
        assert(typeof err === 'object');
        assert(/Parse error/.test(err.message));
        done();
      });
    });
  });

  describe('.renderFile()', function() {
    it('should render templates in a vinyl file:', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('foo')
      });

      hbs.renderFile(vinyl, function (err, file) {
        if (err) return done(err);
        assert(Vinyl.isVinyl(file));
        assert(file.contents.toString() === 'foo');
        done();
      });
    });

    it('should render templates using locals as context:', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      hbs.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
        if (err) return done(err);
        assert(Vinyl.isVinyl(file));
        assert(file.contents.toString() === 'Handlebars');
        done();
      });
    });

    it('should render templates using `file.data` as context:', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};

      hbs.renderFile(vinyl, function (err, file) {
        if (err) return done(err);
        assert(Vinyl.isVinyl(file));
        assert(file.contents.toString() === 'Halle Schlinkert');
        done();
      });
    });

    it('should prefer `file.data` over locals:', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};

      hbs.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
        if (err) return done(err);
        assert(Vinyl.isVinyl(file));
        assert(file.contents.toString() === 'Halle Schlinkert');
        done();
      });
    });

    it('should render templates from a compiled function:', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};
      vinyl.fn = hbs.compile(vinyl.contents.toString());

      hbs.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
        if (err) return done(err);
        assert(Vinyl.isVinyl(file));
        assert(file._isVinyl);
        assert(file.contents.toString() === 'Halle Schlinkert');
        done();
      });
    });

    it('should handle engine errors', function(done) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}}')
      });

      hbs.renderFile(vinyl, function (err, file) {
        assert(err);
        assert(typeof err === 'object');
        assert(/Parse error/.test(err.message));
        done();
      });
    });

    it('should throw an error when not an object', function(done) {
      hbs.renderFile('foo', function (err, file) {
        assert(err.message === 'expected a vinyl file.');
        done();
      });
    });

    it('should throw an error when not a vinyl file', function(done) {
      hbs.renderFile({}, function (err, file) {
        assert(err.message === 'expected a vinyl file.');
        done();
      });
    });
  });
});
