'use strict'

const _ = require('lodash')
const logger = require('./logger').getInstance()

module.exports = (instance, events, config) => {
  const handlers = getEventHandlers(events, config)

  _.forIn(handlers, (handler, eventName) => {
    instance.on(eventName, handlers[eventName])
  })

 logger.debug('[SMT] Subscribed events:', _.keys(handlers))
}

const getEventHandlers = (events, config) => {
  const handlers = {}

  events.forEach(eventName => {
    const handlerName = _.camelCase('on ' + eventName)
    const handler = _.get(config, handlerName)

    if (_.isFunction(handler)) {
      handlers[eventName] = handler
    }
  })

  return handlers
}
