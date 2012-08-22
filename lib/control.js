_controls = [
  {
    pattern: /^short-circuit, status=(\d+)$/,
    action: function (match, res) {
      var code = parseInt(match[1]);
      res.writeHead(code, {'X-Short-Circuit': true});
      res.end();

      // Short-circuit the filter pipeline
      return true;
    }
  },
  {
    pattern: /^empty-reply, wait-sec=(\d+)$/,
    action: function (match, res) {
      var waitSec = parseInt(match[1]);

      setTimeout(function () { res.socket.end() }, waitSec * 1000);
      return true;
    }
  },
  {
    pattern: /^truncate-body, location=(one-off|beginning|middle)$/,
    action: function (match, res) {
      res.x_directive = { truncateBody: match[1] };

      // Allow subsequent filters to run
      return false;
    }
  }
]

exports = module.exports = function (req, res, next) {
  var userAgent = req.headers['user-agent'];
  var directive = req.headers['x-moruga-control'];
  var match = null;

  if (!directive) {
    next();
    return;
  }    

  for (var i = 0; i != _controls.length; ++i) {
    var control = _controls[i];

    var match = control.pattern.exec(directive);
    if (match) {
      var doNext = !control.action(match, res);
      if (doNext) {
        next();
      }

      // Don't bother trying to match other directives
      return;
    }
  }

  // No matches, so proceed as usual
  next();
}
