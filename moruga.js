#!/usr/bin/env node

"use strict"

var modules = [
  'http',
  'https',
  'util',
  'path',
  'fs',
  'url',
  'stream',
  'vm',

  'request',
  "nomnom"
]

modules.forEach(function(module) { global[module] = require(module); })

var knownOpts = {
  url: {
    abbr: 'u',
    metavar: 'URL',
    help: 'URL prefix for the origin server',
    required: true,
    callback: function(channel) {
      var val = url.parse(String(channel))
      if (! val.host || ! (/^https?:/i).test(val.protocol)) {
        return 'url must be a valid HTTP URL';
      }
    }
  },
  port: {
    abbr: 'p',
    help: 'Port on which Moruga should listen (default: 80/443)',
    callback: function(port) {
      if(! /^\d+$/.test(port)) {
        return 'port must be a number'
      }
    }
  },


  filters: {
    abbr: 'f',
    metavar: 'PATH',
    help: 'Path to a filter file',
  },
  verbose: {
    abbr: 'v',
    flag: true,
    help: 'Enable verbose mode',
  },


  'ssl-key': {
    metavar: 'PATH',
    help: 'Enable HTTPS using this private key (PEM)'
  },
  'ssl-cert': {
    metavar: 'PATH',
    help: 'Enable HTTPS using this certificate (PEM)'
  },
  'ssl-passphrase': {
    metavar: 'PATH',
    help: 'Passphrase for the private key, if required'
  },
  'ssl-ca': {
    metavar: 'PATH',
    help: 'Enable HTTPS using this CA file'
  }
}

var options = (function(options) {

  if (options.filters) {
    var filters_filename = options.filters;

    try {
      var filters_js = fs.readFileSync(filters_filename);

      var context = { filters: {} }
      vm.runInNewContext(filters_js, context);

      options.filters = context.filters
    }
    catch (ex) {
      console.log(ex.toString());
      console.log('Could not load the filters file "' + filters_filename + '"');
      process.exit(1);
    }
  }

  if (options['ssl-key']) {
    if (! options['ssl-cert']) {
      console.log('Missing --ssl-cert=PATH');
      process.exit(1);
    }

    try {
      options.ssl = {
        key: fs.readFileSync(options['ssl-key']),
        cert: fs.readFileSync(options['ssl-cert']),
        passphrase: options['ssl-passphrase'] ?
          fs.readFileSync(options['ssl-passphrase']) : null,
        ca: options['ssl-ca'] ?
          fs.readFileSync(options['ssl-ca']) : null
      };
    }
    catch (ex) {
      console.log(ex.toString());
      console.log('Could not read one or more files specified for configuring SSL/TLS');
      process.exit(1);
    }

    // Use the standard port if one wasn't specified
    if (! options.port) {
      options.port = 443;
    }
  }
  else {
    // Use the standard port if one wasn't specified
    if (! options.port) {
      options.port = 80;
    }
  }

  // Convert the port to an integer if it isn't one already
  options.port = +options.port;

  return options;

})(nomnom.options(knownOpts).parse());

var runPreFilters = function(filters, req, res, dump) {
  for (var i = 0; i != filters.length; ++i) {
    var filter = filters[i];
    var match = false;

    if (filter.path && filter.name && (typeof filter.action === 'function')) {
      if (typeof filter.path === 'string') {
        match = (filter.path === req.url);
      }
      else if (typeof filter.path.test === 'function') {
        match = filter.path.test(req.url);
      }

      if (match) {
        dump.log('---> Using Filter: %s (%s)', filter.name, req.url);
        filter.action(req, res);
      }

      if (! res.writable) {
        // The filter closed the response stream; bail out.
        return false;
      }
    }
  }

  return true;
}

var BufferedConsole = function(out) {
  this._buffer = '';
  this.out = out;
};

BufferedConsole.prototype.log = function() {
  if (arguments.length == 1) {
    this.buffer += arguments[0];
  }
  else
  {
    this.buffer += util.format.apply(this, arguments);
  }

  this.buffer += '\n';
}

BufferedConsole.prototype.flush = function() {
  this.out(this.buffer);
  this.buffer = '';
}

BufferedConsole.prototype.brThick = function() {
  this.log('=====================================================');
}

BufferedConsole.prototype.brThin = function() {
  this.log('-----------------------------------------------------');
}

var onRequest = function(req, res) {
  var dump = new BufferedConsole(console.log);

  var originUrl = options.url + req.url;
  console.log('Proxying request to: ' + originUrl);

  if (options.verbose) {
    dump.brThick();
    dump.log('Request');
    dump.brThin();
    dump.log(util.inspect(req.headers));
    dump.brThin();

    req.on('data', function (data) { dump.log(data); });
    req.on('end', function() { dump.brThick()})

    res.on('finish', function() { dump.flush(); });
  }


  if (options.filters && options.filters.pre) {
    if (! runPreFilters(options.filters.pre, req, res, dump)) {
      return;
    }
  }

  // @todo Buffer request data and log it, then pass data + headers
  // on to request.

  req.pipe(request(originUrl, function(error, response, body) {
    if (options.verbose) {
      dump.log('Response');
      dump.brThin();
      dump.log(util.inspect(req.headers));
      dump.brThin();
      dump.log(response.body);
    }

    res.writeHead(response.statusCode, response.headers);
    res.end(body);
  }));
}

process.on('uncaughtException', function (err) {
  if (err.errno === 'EACCES') {
    console.log('Unable to bind to port %d. Permission denied.', options.port);
  }
  else {
    console.log('Fatal exception: ' + err);
  }

  process.exit(1);
});

var server = (options.ssl) ?
  https.createServer(options.ssl, onRequest) :
  http.createServer(onRequest);

server.listen(options.port);

console.log('Listening on *:' + options.port);

