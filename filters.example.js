
exports.pre = [
  {
    name: 'Hunt for bacon'
    path: '/crunchy-bacon',
    action: function(req, resp) {
      resp.end("Soooooo chunky.");

      // Return true IFF you want to stop
      return true;
    }
  }
]