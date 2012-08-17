eval(require('use')(
  'http',
  'connect',
  'url',

  'xregexp#XRegExp'
));

var _camelPattern = XRegExp('\\b\\w', 'g');

// Converts headers into their canonical form
var _camelcaseHeaderNames = function (headers) {
  var fixedHeaders = {};

  Object.keys(headers).forEach(function (headerName) {
    var fixedName = XRegExp.replace(
      headerName, 
      _camelPattern, 
      function(match) {
        return match.toUpperCase();
      }
    );

    fixedHeaders[fixedName] = headers[headerName];
  });

  return fixedHeaders;
}

exports = module.exports = function (urlPrefix) {
  // Forward the request to the target server and write its response
  var _forward = function (req, res, next) {
    var targetUrl = urlPrefix + req.url;
    var options = url.parse(targetUrl);

    options.headers = req.headers;
    options.method = req.method;

    var originReq = http.request(options, function _onOriginResponse(originRes) {
      
      res.writeHead(originRes.statusCode, _camelcaseHeaderNames(originRes.headers));

      // Buffer the response body so we can make the body available to other
      // middleware filters.
      var res_body = new Buffer(0);

      originRes.on('data', function _onOriginResponseData(chunk) {
        res_body = Buffer.concat([res_body, chunk]);
        res.write(chunk);
      });

      originRes.on('end', function _onOriginResponseEnd() {
        res.x_body = res_body;
        res.end();
      });
    });

    // Buffer the request body so we can make the body available to other
    // middleware filters.
    var req_body = new Buffer(0);

    req.on('data', function _onRequestData(chunk) {
      req_body = Buffer.concat([req_body, chunk]);
      originReq.write(chunk);
    });

    req.on('end', function _onRequestEnd() {
      req.x_body = req_body;
      originReq.end();
    });
  }


  return function echo(req, res, next) {
    // Mount safety
    if (req.x_echo) return next();

    if (req.x_context.verbose) console.log('Matched Filter: [Echo]');

    // Flag as echo'd
    req.x_echo = true;
    _forward(req, res, next);
  }
}
