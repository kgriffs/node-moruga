// https://developer.mozilla.org/en/JavaScript/Strict_mode
eval(require('use')(
  'http',
  'https',
  'util',
  'path',
  'fs',
  'url',
  'stream',

  'request',
  'nomnom',
  'connect',

  './proxy',
  './control'
));

"use strict"

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

var _installFilters = function (filters, app) {
  filters.forEach(function(filter) {
    if (filter.path && filter.name && (typeof filter.action === 'function')) {
      app.use(function runFilter(req, res, next) {
        var match = false;

        if (typeof filter.path === 'string') {
          match = (filter.path === req.url);
        }
        else if (typeof filter.path.test === 'function') {
          match = filter.path.test(req.url);
        }

        if (match) {
          if (req.x_context.verbose) {
            console.log('Matched Filter: %s (%s)', filter.name, req.url);
          }

          filter.action(req, res, next);
        }
        else {
          next();
        }
      });
    }
  });
}

var _init = function(options) {
  if (options.filters) {
    // Convert to an absoulute to force require() to not look
    // for a node_modules directory.
    var filtersFilename = path.resolve(options.filters);

    try {
      options.filters = require(filtersFilename).filters;
    }
    catch (ex) {
      console.log(ex.toString());
      console.log('Could not load the filters file "' + filtersFilename + '"');
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

  options.port = parseInt(options.port, 10);

  process.on('uncaughtException', function (err) {
    if (err.errno === 'EACCES') {
      console.log('Unable to bind to port %d. Permission denied.', options.port);
    }
    else {
      console.log("Uncaught exception: " + err);
    }

    process.exit(1);
  });
}

exports.listen = function (options) {
  options = options || nomnom.options(knownOpts).parse();

  _init(options);

  var app = options.ssl ? connect(options.ssl) : connect();

  // Set context for each request
  app.use(function(req, res, next) {
    req.x_context = { verbose: options.verbose };
    next();
  });

  // Hook logging
  if (options.verbose) app.use(require('./log'));

  // Install X-Moruga-Control handler
  app.use(control);

  // Install custom filters
  if (options.filters) _installFilters(options.filters, app);

  // Install core proxying behavior
  app.use(proxy(options.url));

  app.listen(options.port);
  console.log();
  console.log('Listening on *:' + options.port);
  console.log();
}




