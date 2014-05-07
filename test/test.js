
var http = require('http');
var morgan = require('..');
var should = require('should');
var request = require('supertest');

var lastLogLine;
function saveLastLogLine(line) { lastLogLine = line; }

describe('logger()', function () {
  beforeEach(function() {
    lastLogLine = null;
  });

  it('should be able to skip based on request', function (done) {
    function skip(req) { return ~req.url.indexOf('skip=true'); }

    var server = createServer({'format': 'default', 'skip': skip, 'stream': {'write': saveLastLogLine}});

    request(server)
    .get('/?skip=true')
    .set('Connection', 'close')
    .end(function (err, res) {
      if (err) return done(err);
      should.not.exist(lastLogLine);
      done();
    });
  });

  it('should be able to skip based on response', function (done) {
    function skip(req, res) { return res.statusCode === 200; }

    var server = createServer({'format': 'default', 'skip': skip, 'stream': {'write': saveLastLogLine}});

    request(server)
    .get('/')
    .end(function (err, res) {
      if (err) return done(err);
      should.not.exist(lastLogLine);
      done();
    });
  });

  describe('when Connection: close', function () {
    it('should log the client ip', function (done) {
      var server = createServer({'format': 'default', 'stream': {'write': saveLastLogLine}});

      request(server)
      .get('/')
      .set('Connection', 'close')
      .end(function (err, res) {
        if (err) return done(err);
        lastLogLine.should.startWith(res.text);
        done();
      });
    });
  });

  describe('when a custom token is used', function() {
    it('should default to "-" if function for token is undefined', function(done) {
      var server = createServer({
        format: ':does-not-exist',
        stream: {'write': saveLastLogLine}
      });

      request(server)
        .get('/')
        .end(function (err, res) {
          if (err) return done(err);
          lastLogLine.should.equal('-\n');
          done();
        });
    });

    function shouldCallCustomFunctionWhichReturns(falsyValue) {
      it('should call custom function which returns ' + falsyValue, function(done) {
        var server = createServer({
          format: ':custom',
          stream: {'write': saveLastLogLine},
          tokens: {
            custom: function(req, res) { return falsyValue; }
          }
        });

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) return done(err);
            lastLogLine.should.equal('' + falsyValue + '\n');
            done();
          });
      });
    }

    shouldCallCustomFunctionWhichReturns(0);
    shouldCallCustomFunctionWhichReturns(false);
    shouldCallCustomFunctionWhichReturns(undefined);
    shouldCallCustomFunctionWhichReturns('abc');
  });
});

function createServer(opts) {
  var logger = morgan(opts);

  if(opts.tokens) {
    Object.keys(opts.tokens).forEach(function(key) {
      morgan.token(key, opts.tokens[key]);
    });
  }

  var server = http.createServer(function onRequest(req, res) {
    logger(req, res, function onNext(err) {
      res.statusCode = err ? 500 : 200;
      res.end(err ? err.stack : String(req.connection.remoteAddress));
    });
  });

  return server;
}
