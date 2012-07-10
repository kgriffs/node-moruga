#!/usr/bin/env node

exports = module.exports = require('./lib/moruga.js');

if (!module.parent) exports.listen();
