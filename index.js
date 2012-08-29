#!/usr/bin/env node

exports = module.exports = require('./lib/moruga.js');

if (require.main === module) exports.listen();
