
exports.pre = [
  {
    name: 'Hunt for bacon',
    path: '/chunky-bacon',
    action: function(req, res) {
      // End the response stream to tell moruga to halt processing
      // and bail out of this request without proxying it.
      res.end('Soooooo chunky.');
    }
  },
  {
    name: 'Check for breakfast',
    path: new RegExp('/(bacon|eggs|ham|sausage|pancakes|toast|juice|milk|coffee|spam|/)+$', 'i'),
    action: function(req, res) {
      // End the response stream to tell moruga to halt processing
      // and bail out of this request without proxying it.
      res.end("Let's eat!");
    }
  }
]