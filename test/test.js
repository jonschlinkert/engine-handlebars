'use strict';

require('mocha');
var fs = require('fs');
var assert = require('assert');
var path = require('path');
var Vinyl = require('vinyl');
var engine = require('..');

describe('.Handlebars', function () {
  it('should expose the engine.', function () {
    var Handlebars = engine.Handlebars;
    assert(Handlebars.hasOwnProperty('compile'))
    assert(Handlebars.hasOwnProperty('SafeString'))
  });

  it('should expose engine options.', function () {
    assert(engine.options.src.ext === '.hbs');
    assert(engine.options.dest.ext === '.html');
  });

  it('should allow helpers to registered with the engine.', function (done) {
    var Handlebars = engine.Handlebars;
    Handlebars.registerHelper('blah', function (str) {
      return str.toLowerCase();
    });

    var ctx = {name: 'Halle Schlinkert'};

    engine.render('{{blah name}}', ctx, function (err, content) {
      assert(content === 'halle schlinkert');
      done();
    });
  });
});

describe('.compile()', function () {
  it('should compile a template.', function () {
    var fn = engine.compile('Halle {{ name }}');
    assert(typeof fn === 'function');
  });

  it('should render a template with a compiled function.', function () {
    var fn = engine.compile('Halle {{ name }}');
    assert(typeof fn === 'function');
    assert(fn({name: 'Schlinkert'}) === 'Halle Schlinkert');
  });

  it('should immediately return an already compiled function.', function () {
    var compiled = engine.compile('Halle {{ name }}');
    var fn = engine.compile(compiled);
    assert(typeof fn === 'function');
    assert(fn({name: 'Schlinkert'}) === 'Halle Schlinkert');
  });
});


describe('.render()', function() {
  it('should render templates in a string:', function(done) {
    var ctx = {name: 'Halle Schlinkert'};
    engine.render('{{ name }}', ctx, function (err, content) {
      assert(content === 'Halle Schlinkert');
      done();
    });
  });

  it('should render templates from a compiled function:', function(done) {
    var ctx = {name: 'Halle Schlinkert'};
    var fn = engine.compile('{{ name }}');
    engine.render(fn, ctx, function (err, content) {
      assert(content === 'Halle Schlinkert');
      done();
    });
  });

  it('should work with no context:', function(done) {
    var fn = engine.compile('foo');
    engine.render(fn, function (err, content) {
      assert(content === 'foo');
      done();
    });
  });

  it('should handle engine errors:', function(done) {
    engine.render('{{foo}}}', function (err, content) {
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

    engine.render('{{upper (include "content.hbs")}}', ctx, function (err, content) {
      if (err) return done(err);
      assert(content === 'JON SCHLINKERT');
      done();
    });
  });

  it('should use partials passed on the options.', function(done) {
    var ctx = {partials: {a: 'foo', b: 'bar'}};

    engine.render('{{> a }}{{> b }}', ctx, function (err, content) {
      if (err) return done(err);
      assert(content === 'foobar');
      done();
    });
  });
});


describe('.renderSync()', function () {
  it('should render a template.', function () {
    var str = engine.renderSync('Halle {{ name }}', {name: 'Schlinkert'});
    assert(str === 'Halle Schlinkert');
  });

  it('should render a template from a compiled function.', function () {
    var fn = engine.compile('Halle {{ name }}');
    var str = engine.renderSync(fn, {name: 'Schlinkert'});
    assert(str === 'Halle Schlinkert');
  });

  it('should throw engine errors:', function() {
    try {
      engine.renderSync('{{foo}}}');
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

    engine.__express('test/fixtures/default.hbs', ctx, function (err, content) {
      assert(content === 'Halle Schlinkert');
      done();
    });
  });

  it('should work when the callback is the second arg', function(done) {
    engine.__express('test/fixtures/content.hbs', function (err, content) {
      assert(content === 'Jon Schlinkert');
      done();
    });
  });

  it('should handle engine errors:', function(done) {
    engine.__express('test/fixtures/bad.hbs', {}, function (err, content) {
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

    engine.renderFile(vinyl, function (err, file) {
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

    engine.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
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

    engine.renderFile(vinyl, function (err, file) {
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

    engine.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
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
    vinyl.fn = engine.compile(vinyl.contents.toString());

    engine.renderFile(vinyl, {name: 'Handlebars'}, function (err, file) {
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

    engine.renderFile(vinyl, function (err, file) {
      assert(err);
      assert(typeof err === 'object');
      assert(/Parse error/.test(err.message));
      done();
    });
  });

  it('should throw an error when not an object', function(done) {
    engine.renderFile('foo', function (err, file) {
      assert(err.message === 'expected a vinyl file.');
      done();
    });
  });

  it('should throw an error when not a vinyl file', function(done) {
    engine.renderFile({}, function (err, file) {
      assert(err.message === 'expected a vinyl file.');
      done();
    });
  });
});
