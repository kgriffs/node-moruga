eval(require('use')(
  'http',
  'https',
  'connect',
  'url',
  'util',

  'xregexp#XRegExp'
));

var proxy = {}

proxy.camelPattern = XRegExp('\\b\\w', 'g');

// Converts headers into their canonical form
proxy.camelcaseHeaderNames = function (headers) {
  var fixedHeaders = {};

  Object.keys(headers).forEach(function (headerName) {
    var fixedName = XRegExp.replace(
      headerName, 
      proxy.camelPattern, 
      function(match) {
        return match.toUpperCase();
      }
    );

    fixedHeaders[fixedName] = headers[headerName];
  });

  return fixedHeaders;
}


exports = module.exports = function (urlPrefix) {

  var origin_uses_https = ('https:' == url.parse(urlPrefix).protocol);  
  var agent = new (origin_uses_https ? https : http).Agent({
    rejectUnauthorized: true
  });

  var request = function(options, callback) {
    options.agent = agent;
    return (origin_uses_https ? https : http).request(options, callback);
  } 

  // Forward the request to the target server and write its response
  var forward = function (req, res, next) {
    var targetUrl = urlPrefix + req.url;
    var options = url.parse(targetUrl);

    options.headers = req.headers;
    options.method = req.method;  

    var originReq = request(options);

    // Setup streaming with a buffer
    // @todo Use an EventEmitter or stream instead for propagating the body
    var reqBody = new Buffer(0);

    req.on('data', function onRequestData(chunk) {
      reqBody = Buffer.concat([reqBody, chunk]);
      originReq.write(chunk);
    });

    req.on('end', function onRequestEnd() {
      req.x_body = reqBody;
      originReq.end();
    });

    // Handle origin request events
    originReq.on('error', function onOriginError(err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});

      if (err.errno == 'ENOTFOUND') {
        res.end(util.format('Host %s not found', options.host));
      } 
      else {
        res.end(err.message);
      }
    });

    originReq.on('response', function onOriginResponse(originRes) {
      var bufferResponse = (res.x_directive && res.x_directive.truncateBody);
      res.writeHead(originRes.statusCode, proxy.camelcaseHeaderNames(originRes.headers));
      // Buffer the response body so we can make the body available to other
      // middleware filters.
      //
      // Todo: Refactor to use an event emitter
      var resBody = new Buffer(0);

      originRes.on('data', function onOriginResponseData(chunk) {
        resBody = Buffer.concat([resBody, chunk]);

        if (!bufferResponse) res.write(chunk);
      });

      originRes.on('end', function onOriginResponseEnd() {
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
  }

  

  return function echo(req, res, next) {
    // Mount safety
    if (req.x_echo) return next();

    if (req.x_context.verbose) console.log('Matched Filter: [Echo]');

    // Flag as echo'd
    req.x_echo = true;
    forward(req, res, next);
  }
}
