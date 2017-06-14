'use strict'

// import node modules.
const _ = require('lodash')
const Connector = require('./connector')
const Messager = require('./messager')
const logger = require('./utils/logger').getInstance()



module.exports = class SmartQQClient {
  constructor(config) {
    this.conn = new Connector(config)
    this.msg = new Messager(config)
  }

  open() {
    this.conn.connect()
    logger.info('[SMT] Client is ready')
    this.conn.once('ready', () => {
      this.msg.setContext(this.conn.context)
      this.msg.receive()
    })
    this.msg.once('fatal', () => {
      this.conn.disconnect()
    })
  }

  sendMessage(message) {
    logger.info('[SMT] Sending message', message)
    if (!message || !message.context) {
      logger.error('[SMT] Cannot send empty message')
    } else if (!message.to || !_.isNumber(message.to)) {
      logger.error('[SMT] Unexpecting value of [to] for sending message')
    } else if (message.type === 'discu') {
      this.msg.sendToDiscu(message.to, message.context)
    } else {
      logger.error('[SMT] Unexpecting message type')
    }

  }
}
