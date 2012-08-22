Moruga
======

Moruga is a spider genus, a district in Trinidad, the hottest pepper in the world, and a transparent HTTP debugging proxy.

<img src="http://caribbeancelebs.com/wp-content/uploads/2012/02/Trinidad-Moruga-Scorpion.jpg" width="300px"/>

### Installation ###

Moruga requires Node.js and NPM. If you installed Node from a package, you already have NPM. 

To install Moruga as a binary in your PATH, run this in your console:

```bash
git clone https://github.rackspace.com/atl/moruga
cd moruga
sudo npm install . -g
```

Run moruga without any parameters to view available options.

```bash
moruga
```

### HTTP Example ###

```bash
moruga -u http://duckduckgo.com -f filters.example.js -v
```

* Listen for HTTP requests on all IP addresses, using port 80
* Import the filters.example.js module and load its *filters* array
* Proxy requests to http://duckduckgo.com[PATH_AND_QUERY_STRING]
  * E.g.: http://moruga.example.com/chunky?meat=bacon ---> http://duckduckgo.com/chunky?meat=bacon
* Print requests/responses to/from the user agent

### HTTPS Example ###

```bash
moruga -u http://duckduckgo.com -f filters.example.js --ssl-key=server-key.pem --ssl-cert=server-cert.pem
```

* Listen for HTTPS requests on all IP addresses, using port 443
* Use default list of CAs, including well-known ones like Verisign
* mport the filters.example.js module and load its *filters* array
* Proxy requests to http://duckduckgo.com[PATH_AND_QUERY_STRING]

### Built-in Filters ###

Moruga comes with two built-in filters. The first is a request/response logger, which is enabled with the -v option on the command line. Currently, the build-in logger only outputs headers, but adding an option to write out message bodies.

The second built-in filter is a handler for the custom X-Moruga-Control header. Using this header, you can trigger specific actions for each request. This is useful for writing unit tests.

The built-in X-Moruga-Control handler recognizes the following directives:

```
/^short-circuit, status=(\d+)$/
/^empty-reply, wait-sec=(\d+)$/
/^truncate-body, location=(one-off|beginning|middle)$/
```

For example, to test response handling in your code for a particular HTTP status code, include this header line in the client's request:

```
X-Moruga-Control: short-circuit, status=403
```

### Filter Pipeline ###

Moruga uses the popular [Connect](http://www.senchalabs.org/connect/) library to create a filter pipeline for proxied HTTP requests. Each filter contains a human-readable name, URL path to match on, and an action. A custom actions may terminate the filter pipeline and return its own response, or allow processing to continue down the pipe.

For example, if I want to short-circuit every request to '/chunky-bacon' in order to express my approval of a certain type of breakfast meat, the following filter will do the trick:

```javascript
{
  name: 'Chunky Bacon',
  path: '/chunky-bacon',

  // Connect-compatible middleware function
  action: function(req, res, next) {
    res.writeHead(200, {'X-Short-Circuit': true});
    res.end('Soooooo chunky.');

    // Uncomment if you want to allow remaining filters
    // to run, but usually you won't do this after
    // calling res.end()

    // next();
  }
}
```

The path may be a string or a RegEx-compatible object. In the latter case, the only requirment is that the object expose a *test* function that returns a truthy value for a successful match.

Here is another filter that matches all URLs except the root path, logs a message, and passes control to the next filter in the pipeline, if any.

```js
{
  name: 'Noop',
  path: /^\/.+/,

  action: function(req, res, next) {
    console.log('noop');

    // Pass control to the next filter in the pipeline, if any
    next();
  }
}
```

And, finally, a more complex example showing how you can trigger different behaviors from a unit-test using a custom header:

```js
{
  name: 'Handler for X-Moruga-Control',
  path: /^\/.*/,
  action: function(req, res, next) {
    var control = req.headers['x-moruga-control'];

    if (!control) {
      next();
      return;
    }

    var match = /^short-circuit, status=(\d+)/.exec(control);

    if (match) {
      var code = parseInt(match[1]);
      res.writeHead(code, {'X-Short-Circuit': true});
      res.end();
      return;
    }

    next();
  }
}
```  

### Custom Filters module ###

Moruga can load custom filters from a filter module file. The module simply needs to export an array named *filters*, containing a list of filter objects. 

*Note: Filters are installed in the pipeline in the same order as they appear in the array.*

An example filters module:

```js
// This is a regular Node module, so you can do anything you like
var util = require('util');

exports.filters = [
  {
    name: 'Chunky Bacon',
    path: '/chunky-bacon',

    // Connect middleware
    action: function(req, res, next) {
      res.writeHead(200, {'X-Short-Circuit': true});
      res.end('Soooooo chunky.');
    }
  },
  {
    name: 'Breakfast',
    path: new RegExp('/(bacon|eggs|ham|sausage|pancakes|toast|juice|milk|coffee|spam|/)+$', 'i'),

    // Connect middleware
    action: function(req, res, next) {
      res.writeHead(200, {'X-Short-Circuit': true});
      res.end("Let's eat!");
    }
  },
  {
    name: '503 on initial auth and randomly thereafter',
    path: /^\/v\d+.\d+\/agent\/auth$/i,
    action: function(req, res, next) {
      var userAgent = req.headers['user-agent'];

      // Return 503 10% of the time
      var trigger = Math.random() > 0.90;

      if (trigger || !this._authedByAgent[userAgent]) {
        this._authedByAgent[userAgent] = true;
        res.writeHead(503, {'X-Short-Circuit': true});
        res.end();
      }
      else {
        next();
      }
    },

    _authedByAgent: {}
  }
]
```

