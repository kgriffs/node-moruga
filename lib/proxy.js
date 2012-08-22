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
      var bufferResponse = (res.x_directive && res.x_directive.truncateBody);
      res.writeHead(originRes.statusCode, _camelcaseHeaderNames(originRes.headers));

      // Buffer the response body so we can make the body available to other
      // middleware filters.
      //
      // Todo: Refactor to use an event emitter
      var resBody = new Buffer(0);

      originRes.on('data', function _onOriginResponseData(chunk) {
        resBody = Buffer.concat([resBody, chunk]);

        if (!bufferResponse) res.write(chunk);
      });

      originRes.on('end', function _onOriginResponseEnd() {
        if (bufferResponse) {
          if (res.x_directive) {
            var location = res.x_directive.truncateBody;

            if (location === 'beginning') resBody = resBody.slice(0, 0);
            else if (location === 'one-off') resBody = resBody.slice(0, resBody.length - 1);
            else if (location === 'middle') resBody = resBody.slice(0, resBody.length / 2);
          
            res.write(resBody);
            res.socket.destroy();
          }
          else {
            res.write(resBody);
          }
        }
        else {
          res.end();
        }

        res.x_body = resBody;
      });
    });

    // Buffer the request body so we can make the body available to other
    // middleware filters.
    var reqBody = new Buffer(0);

    req.on('data', function _onRequestData(chunk) {
      reqBody = Buffer.concat([reqBody, chunk]);
      originReq.write(chunk);
    });

    req.on('end', function _onRequestEnd() {
      req.x_body = reqBody;
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
