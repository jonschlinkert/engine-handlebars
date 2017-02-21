'use strict';

require('mocha');
var fs = require('fs');
var assert = require('assert');
var path = require('path');
var Vinyl = require('vinyl');
var engine = require('..');

describe('engine-handlebars', function() {
  describe('.Handlebars', function() {
    it('should expose the engine.', function() {
      var Handlebars = engine.Handlebars;
      assert(Handlebars.hasOwnProperty('compile'));
      assert(Handlebars.hasOwnProperty('SafeString'));
    });

    it('should expose engine options.', function() {
      assert.equal(engine.options.src.ext, '.hbs');
      assert.equal(engine.options.dest.ext, '.html');
    });

    it('should allow helpers to registered with the engine.', function(cb) {
      var Handlebars = engine.Handlebars;
      Handlebars.registerHelper('blah', function(str) {
        return str.toLowerCase();
      });

      var ctx = {name: 'Halle Schlinkert'};

      engine.render('{{blah name}}', ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'halle schlinkert');
        cb();
      });
    });
  });

  describe('.compile()', function() {
    it('should compile a template.', function() {
      var fn = engine.compile('Halle {{ name }}');
      assert.equal(typeof fn, 'function');
    });

    it('should render a template with a compiled function.', function() {
      var fn = engine.compile('Halle {{ name }}');
      assert.equal(typeof fn, 'function');
      assert.equal(fn({name: 'Schlinkert'}), 'Halle Schlinkert');
    });

    it('should immediately return an already compiled function.', function() {
      var compiled = engine.compile('Halle {{ name }}');
      var fn = engine.compile(compiled);
      assert.equal(typeof fn, 'function');
      assert.equal(fn({name: 'Schlinkert'}), 'Halle Schlinkert');
    });
  });

  describe('.render()', function() {
    it('should render templates in a string:', function(cb) {
      var ctx = {name: 'Halle Schlinkert'};
      engine.render('{{ name }}', ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'Halle Schlinkert');
        cb();
      });
    });

    it('should render templates from a compiled function:', function(cb) {
      var ctx = {name: 'Halle Schlinkert'};
      var fn = engine.compile('{{ name }}');
      engine.render(fn, ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'Halle Schlinkert');
        cb();
      });
    });

    it('should work with no context:', function(cb) {
      var fn = engine.compile('foo');
      engine.render(fn, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'foo');
        cb();
      });
    });

    it('should handle engine errors:', function(cb) {
      engine.render('{{foo}}}', function(err, content) {
        assert(err);
        assert.equal(typeof err, 'object');
        assert(/Parse error/.test(err.message));
        cb();
      });
    });

    it('should use helpers passed on the options.', function(cb) {
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

      engine.render('{{upper (include "content.hbs")}}', ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'JON SCHLINKERT');
        cb();
      });
    });

    it('should use partials passed on the options.', function(cb) {
      var ctx = {partials: {a: 'foo', b: 'bar'}};

      engine.render('{{> a }}{{> b }}', ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'foobar');
        cb();
      });
    });
  });

  describe('.renderSync()', function() {
    it('should render a template.', function() {
      var str = engine.renderSync('Halle {{ name }}', {name: 'Schlinkert'});
      assert.equal(str, 'Halle Schlinkert');
    });

    it('should render a template from a compiled function.', function() {
      var fn = engine.compile('Halle {{ name }}');
      var str = engine.renderSync(fn, {name: 'Schlinkert'});
      assert.equal(str, 'Halle Schlinkert');
    });

    it('should throw engine errors:', function() {
      try {
        engine.renderSync('{{foo}}}');
      } catch (err) {
        assert(err);
        assert.equal(typeof err, 'object');
        assert(/Parse error/.test(err.message));
      }
    });
  });

  describe('express support', function() {
    it('should render templates from a file.', function(cb) {
      var ctx = {name: 'Halle Schlinkert'};

      engine.__express('test/fixtures/default.hbs', ctx, function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'Halle Schlinkert');
        cb();
      });
    });

    it('should work when the callback is the second arg', function(cb) {
      engine.__express('test/fixtures/content.hbs', function(err, content) {
        if (err) return cb(err);
        assert.equal(content, 'Jon Schlinkert');
        cb();
      });
    });

    it('should handle engine errors:', function(cb) {
      engine.__express('test/fixtures/bad.hbs', {}, function(err, content) {
        assert(err);
        assert.equal(typeof err, 'object');
        assert(/Parse error/.test(err.message));
        cb();
      });
    });
  });

  describe('.renderFile()', function() {
    it('should render templates in a vinyl file:', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('foo')
      });

      engine.renderFile(vinyl, function(err, file) {
        if (err) return cb(err);
        assert(Vinyl.isVinyl(file));
        assert.equal(file.contents.toString(), 'foo');
        cb();
      });
    });

    it('should render templates using locals as context:', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      engine.renderFile(vinyl, {name: 'Handlebars'}, function(err, file) {
        if (err) return cb(err);
        assert(Vinyl.isVinyl(file));
        assert.equal(file.contents.toString(), 'Handlebars');
        cb();
      });
    });

    it('should render templates using `file.data` as context:', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};

      engine.renderFile(vinyl, function(err, file) {
        if (err) return cb(err);
        assert(Vinyl.isVinyl(file));
        assert.equal(file.contents.toString(), 'Halle Schlinkert');
        cb();
      });
    });

    it('should prefer `file.data` over locals:', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};

      engine.renderFile(vinyl, {name: 'Handlebars'}, function(err, file) {
        if (err) return cb(err);
        assert(Vinyl.isVinyl(file));
        assert.equal(file.contents.toString(), 'Halle Schlinkert');
        cb();
      });
    });

    it('should render templates from a compiled function:', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}')
      });

      vinyl.data = {name: 'Halle Schlinkert'};
      vinyl.fn = engine.compile(vinyl.contents.toString());

      engine.renderFile(vinyl, {name: 'Handlebars'}, function(err, file) {
        if (err) return cb(err);
        assert(Vinyl.isVinyl(file));
        assert(file._isVinyl);
        assert.equal(file.contents.toString(), 'Halle Schlinkert');
        cb();
      });
    });

    it('should handle engine errors', function(cb) {
      var vinyl = new Vinyl({
        path: 'foo.hbs',
        contents: new Buffer('{{ name }}}')
      });

      engine.renderFile(vinyl, function(err, file) {
        assert(err);
        assert.equal(typeof err, 'object');
        assert(/Parse error/.test(err.message));
        cb();
      });
    });

    it('should throw an error when not an object', function(cb) {
      engine.renderFile('foo', function(err, file) {
        assert.equal(err.message, 'expected a vinyl file.');
        cb();
      });
    });

    it('should throw an error when not a vinyl file', function(cb) {
      engine.renderFile({}, function(err, file) {
        assert.equal(err.message, 'expected a vinyl file.');
        cb();
      });
    });
  });
});
