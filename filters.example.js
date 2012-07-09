exports.pre = [
  {
    name: 'Hunt for bacon',
    path: '/chunky-bacon',
    action: function(req, res) {
      // End the response stream to tell moruga to halt processing
      // and bail out of this request without proxying it.
      res.writeHead(200, {'X-Moruga-Intercepted': true});
      res.end('Soooooo chunky.');
    }
  },
  {
    name: 'Check for breakfast',
    path: new RegExp('/(bacon|eggs|ham|sausage|pancakes|toast|juice|milk|coffee|spam|/)+$', 'i'),
    action: function(req, res) {
      // End the response stream to tell moruga to halt processing
      // and bail out of this request without proxying it.
      res.writeHead(200, {'X-Moruga-Intercepted': true});
      res.end("Let's eat!");
    }
  },
  {
    name: '503 on initial auth and randomly thereafter',
    path: /^\/v\d+.\d+\/agent\/auth$/i,
    action: function(req, res) {
      var user_agent = req.headers['user-agent'];

      // Return 503 10% of the time
      var trigger = Math.random() > 0.90;

      if (trigger || !this._authed_by_agent[user_agent]) {
        this._authed_by_agent[user_agent] = true;
        res.writeHead(503, {'X-Moruga-Intercepted': true});
        res.end();
      }
    },

    _authed_by_agent: {}
  }
]