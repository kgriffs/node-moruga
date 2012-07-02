#!/usr/bin/env node

var http = require('http');
var util = require('util');
var path = require('path');
var fs = require('fs');
var request = require('request');
var url = require('url');
var nomnom = require("nomnom");
var stream = require('stream');

var knownOpts = {
  url: {
    abbr: 'u',
    metavar: 'URL',
    help: 'URL prefix for the origin server. Prepended to the path portion of the URL sent to the proxy to create the URL used in the request to the origin server.',
    required: true,
    callback: function(channel) {
      val = url.parse(String(channel))
      if (! val.host || ! (/^https?:/i).test(val.protocol)) {
        return "url must be a valid HTTP URL";
      }
    }
  },
  filters: {
    abbr: 'f',
    metavar: 'PATH',
    help: 'Path to a JavaScript filter file. The file should export a list of pre and post filters to run on each request. See also filters.example.js',
    required: false
  },
  verbose: {
    abbr: 'v',
    flag: true,
    help: 'Enable verbose mode. Dumps requests and responses to stdout.',
    required: false
  }
}

var options = nomnom.options(knownOpts).parse();

if (options.filters) {

  // Do this silly dance to ensure a directory prefix on the module
  // name; otherwise, require won't look in the right place.
  var filters_module_name = options.filters;
  if (filters_module_name.indexOf('.' + path.sep) !== 0) {
    if (path.dirname(options.filters) === '.') {
      filters_module_name = '.' + path.sep + filters_module_name;
    }
  }

  try {
    options.filters = require(filters_module_name);
  }
  catch (ex) {
    console.log("The filters file \"" + options.filters + "\" could not be loaded. " + ex);
    process.exit(1);
  }
}

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

var server = http.createServer(function(req, res) {
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
});



server.listen(9000);
