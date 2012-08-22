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
      var user_agent = req.headers['user-agent'];

      // Return 503 10% of the time
      var trigger = Math.random() > 0.90;

      if (trigger || !this._authed_by_agent[user_agent]) {
        this._authed_by_agent[user_agent] = true;
        res.writeHead(503, {'X-Short-Circuit': true});
        res.end();
      }
      else {
        next();
      }
    },

    _authed_by_agent: {}
  }
]
