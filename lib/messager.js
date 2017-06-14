'use strict'

// import node modules.
const _ = require('lodash')
const EE3 = require('eventemitter3')
const Net = require('./utils/net')
const bind = require('./utils/bind')
const logger = require('./utils/logger').getInstance()

const MESSAGE_TYPES = ['message', 'group_message', 'discu_message']
const CUSTOM_EVENTS = ['message', 'groupMessage', 'discuMessage']

module.exports = class Messager extends EE3 {
  constructor(config) {
    super()
    bind(this, CUSTOM_EVENTS, config)
  }

  setContext(context) {
    Object.assign(this, _.pick(context, ['ptwebqq', 'psessionid']))
  }

  async receive() {
    const postData = {
      ptwebqq: this.ptwebqq,
      clientid: 53999199,
      psessionid: this.psessionid,
      key: '' 
    }

    logger.log('[SMT] Listening QQ messages...')
    try {
      let res = await Net.callApi('POLL_MESSAGE', { 
        body: 'r=' + JSON.stringify(postData)
      })
      let ret = await res.json()
      logger.log('[SMT] New message response incoming', _.pick(ret, ['retcode', 'errmsg']))
      
      if (ret.retcode === 0 && ret.errmsg) {
        logger.log('[SMT] Timeout response, trigger onTimeout')
        this.receive()
      } else if (ret.retcode === 103) {
        logger.fatal('[SMT] 103 status occurs, trigger onDisconnected')
        this.emit('fatal')
      } else if (ret.result instanceof Array) {
        logger.info('[SMT] response contains', ret.result.length, 'message(s)')
        ret.result.forEach(r => {
          if (MESSAGE_TYPES.indexOf(r.poll_type) > -1) {
            logger.info('[SMT] Trigger event on', r.poll_type)
            this.emit(_.camelCase(r.poll_type), r.value)
          } else {
            logger.warn('[SMT] Message type is unknown', r.poll_type)
          }
        })

        this.receive()
      }
    } catch (err) {
      this.logger.error('err', err)
    }
  }

  async sendToDiscu(discuId, message) {
    if (!_.isString(message)) {
      throw new Error('[SMT] Unexpected message content. Expecting string.')
    }

    console.log(message)
    console.log(this)

    const postData = {
      did: discuId,
      content: JSON.stringify([ message, ['font', { name: '宋体', size: 10, style: [ 0, 0, 0 ], color: '000000' }]]),
      face: 561,
      clientid: 53999199,
      msg_id: _.random(65950001, 75950001),
      psessionid: this.psessionid,
    }

    logger.info('[SMT] Sending discu message:', JSON.stringify(postData))
    try {
      let res = await Net.callApi('SEND_MESSAGE_TO_DISCUSS', { 
        body: 'r=' + JSON.stringify(postData)
      })
      let ret = await res.json()
      logger.log('[RES]', JSON.stringify(ret))
    } catch (err) {
      this.logger.error('err', err)
    }
  }
}
