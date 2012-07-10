var http = require('http');
var util = require('util');

var _printHeaders = function (prefix, headers) {
  Object.keys(headers).forEach(function(key) {
    console.log('%s %s: %s', prefix, key, headers[key]);
  });
}

var _parseHeaders = function(str) {
  var headers = {};
  var pairs = str.split('\r\n');

  pairs.forEach(function (pair) {
    var colon_pos = pair.indexOf(':');
    if (-1 == colon_pos) return;

    var key = pair.substr(0, colon_pos);
    var val = pair.substr(colon_pos + 2);
    val.trim();

    headers[key] = val;
  });

  return headers;
}

var _printAll = function (req, res) {
  console.log('----------------------------------------------------------------');
  console.log('> %s %s HTTP/%s', req.method, req.url, req.httpVersion);
  _printHeaders('>', req.headers);
  console.log('>');
  console.log('< HTTP/%s %d %s', req.httpVersion, res.statusCode, http.STATUS_CODES[res.statusCode]);
  _printHeaders('<', _parseHeaders(res._header));
  console.log('<');
  console.log('----------------------------------------------------------------');
}

exports = module.exports = function log(req, res, next) {
  res.on('finish', function() {
    _printAll(req, res);
  });

  next();
}