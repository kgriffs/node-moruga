
exports.pre = [
  {
    name: 'Hunt for bacon',
    path: '/chunky-bacon',
    action: function(req, resp) {
      // End the response stream to tell moruga to halt processing
      // and bail out of this request without proxying it.
      resp.end("Soooooo chunky.");
    }
  }
]