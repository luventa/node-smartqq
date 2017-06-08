'use strict'

const util = require('util')
const _ = require('lodash')

const DEFAULT_PROVIDER = {
  log: console.log,
  debug: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error
}

const LEVELS = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  silent: 6
}

// define instance and default variables
let _instance
let _level = 2
let _provider = DEFAULT_PROVIDER

module.exports = {
  // singleton
  getInstance: (levelName, providerFn) => {
    if (!_instance) {
      _instance = new Logger(levelName, providerFn)
    }

    return _instance
  }
}

const interpolate = (args) => {
  let fn = _.spread(util.format)
  return fn(_.slice(args))
}

const isValidProvider = providerFn => {
  if (!providerFn) {
    return false
  } else if (!_.isFunction(providerFn)) {
    throw new Error('[SMQ] Log provider config error. Expecting a function.')
  }

  return true
}

const isValidLevel = levelName => {
  if (!_.isString(levelName)) {
    throw new Error('[SMQ] Log level error. Expecting a string.')
  } else if (!LEVELS.hasOwnProperty(levelName)) {
    throw new Error('[SMQ] Log level error. Expecting debug|info|warn|error|fatal|silent.')
  }

  return true
}

class Logger {
  constructor (levelName, providerFn) {
    if (levelName && isValidLevel(levelName)) {
      _level = LEVELS[levelName]
    }

    if (isValidProvider(providerFn)) {
      _provider = Object.assign({}, DEFAULT_PROVIDER, providerFn())
    }
  }

  log() {
    _provider.log(interpolate(arguments))
  }

  debug() {
    if (_level <= LEVELS['debug']) 
      _provider.debug(interpolate(arguments))
  }

  info() {
    if(_level <= LEVELS['info'])
      _provider.info(interpolate(arguments))
  }

  warn() {
    if(_level <= LEVELS['warn'])
      _provider.warn(interpolate(arguments))
  }

  error() {
    if(_level <= LEVELS['error'])
      _provider.error(interpolate(arguments))
  }

  fatal() {
    if(_level <= LEVELS['fatal'])
      _provider.fatal(interpolate(arguments))
  }
}
