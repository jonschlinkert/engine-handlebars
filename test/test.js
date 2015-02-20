/*!
 * engine-handlebars <https://github.com/jonschlinkert/engine-handlebars>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

var fs = require('fs');
var path = require('path');
require('should');
var engine = require('..');


describe('.Handlebars', function () {
  it('should expose the engine.', function () {
    var Handlebars = engine.Handlebars;
    Handlebars.should.have.properties(['compile', 'SafeString']);
  });

  it('should allow helpers to registered with the engine.', function (done) {
    var Handlebars = engine.Handlebars;
    Handlebars.registerHelper('blah', function (str) {
      return str.toLowerCase();
    });

    var ctx = {name: 'Jon Schlinkert'};

    engine.render('{{blah name}}', ctx, function (err, content) {
      content.should.equal('jon schlinkert');
      done();
    });
  });
});


describe('.renderSync()', function () {
  it('should render templates.', function () {
    var str = engine.renderSync('Jon {{ name }}', {name: 'Schlinkert'});
    str.should.equal('Jon Schlinkert');
  });
});


describe('.render()', function() {
  it('should render templates.', function(done) {
    var ctx = {name: 'Jon Schlinkert'};

    engine.render('{{ name }}', ctx, function (err, content) {
      content.should.equal('Jon Schlinkert');
      done();
    });
  });

  it('should use helpers passed on the options.', function(done) {
    var ctx = {
      name: 'Jon Schlinkert',
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
      if (err) console.log(err);

      content.should.equal('JON SCHLINKERT');
      done();
    });
  });

  it('should use partials passed on the options.', function(done) {
    var ctx = {
      partials: {
        a: 'foo',
        b: 'bar'
      }
    };

    engine.render('{{> a }}{{> b }}', ctx, function (err, content) {
      if (err) console.log(err);
      content.should.equal('foobar');
      done();
    });
  });
});


describe('.renderFile()', function() {
  it('should render templates from a file.', function(done) {
    var ctx = {name: 'Jon Schlinkert'};

    engine.renderFile('test/fixtures/default.hbs', ctx, function (err, content) {
      content.should.equal('Jon Schlinkert');
      done();
    });
  });
});