#!/usr/bin/env node

var http = require('http');
var util = require('util');
var fs = require('fs');
var request = require('request');
var url = require('url');
var nomnom = require("nomnom");

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
  try {
    options.filters = require(options.filters);
  }
  catch (ex) {
    console.log("The filters file \"" + options.rules + "\" could not be loaded. " + ex);
    process.exit(1);
  }
}

var runPreFilters = function(filters, req, res) {
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
        console.log('---> Filter: %s (%s)', filter.name, req.url);
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

var br_thick = '=====================================================';
var br_thin = '-----------------------------------------------------';

var server = http.createServer(function(req, res) {
  var dump = {
    buffer: '',
    log: function(str) {
      this.buffer += str;
      this.buffer += '\n';
    }
  };

  var originUrl = options.url + req.url;
  console.log('Proxying request to: ' + originUrl);

  if (options.verbose) {
    dump.log(br_thick);
    dump.log('Request');
    dump.log(br_thin);
    dump.log(util.inspect(req.headers));
    dump.log(br_thin);

    req.on('data', function (data) { dump.log(data); });
    req.on('end', function() { dump.log(br_thick)})

    res.on('finish', function() { console.log(dump.buffer); });
  }


  if (options.filters && options.filters.pre) {
    if (! runPreFilters(options.filters.pre, req, res)) {
      return;
    }
  }

  req.pipe(request(originUrl, function(error, response, body) {
    if (options.verbose) {
      dump.log('Response');
      dump.log(br_thin);
      dump.log(util.inspect(req.headers));
      dump.log(br_thin);
      dump.log(response.body);
    }

    res.writeHead(response.statusCode, response.headers);
    res.end(body);
  }));
});



server.listen(9000);
