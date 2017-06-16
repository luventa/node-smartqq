'use strict'

// import node modules.
const _ = require('lodash')
const EE3 = require('eventemitter3')
const Net = require('./utils/net')
const bind = require('./utils/bind')
const logger = require('./utils/logger').getInstance()

const MESSAGE_TYPES = ['message', 'group_message', 'discu_message']
const CUSTOM_EVENTS = ['message', 'groupMessage', 'discuMessage', 'messageSent', 'sendFailed']

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
          const msgType = _.camelCase(r.poll_type)
          if (CUSTOM_EVENTS.indexOf(msgType) > -1) {
            logger.info('[SMT] Trigger event on', msgType)
            const msg = {
              content: _.slice(_.get(r.value, 'content'), 1).join(' '),
              from: _.get(r.value, 'from_uin'),
              sentBy: _.get(r.value, 'send_uin') // for group and discu message
            }
            console.log(msg)
            this.emit(msgType, msg)
          } else {
            logger.warn('[SMT] Message type is unknown', r.poll_type)
          }
        })

        this.receive()
      }
    } catch (err) {
      logger.error('err', err)
    }
  }

  async send(friendId, message) {
    if (!_.isString(message)) {
      throw new Error('[SMT] Unexpected message content. Expecting string.')
    }

    const postData = this.enrich({ to: friendId }, message)

    logger.info('[SMT] Sending discu message:', postData)
    try {
      let res = await Net.callApi('SEND_MESSAGE_TO_FRIEND', { 
        body: 'r=' + postData
      })
      this.processSendRes(await res.json())
    } catch (err) {
      logger.error('err', err)
    }
  }

  async sendToGroup(groupId, message) {
    if (!_.isString(message)) {
      throw new Error('[SMT] Unexpected message content. Expecting string.')
    }

    const postData = this.enrich({ group_uin: groupId }, message)

    logger.info('[SMT] Sending discu message:', postData)
    try {
      let res = await Net.callApi('SEND_MESSAGE_TO_GROUP', { 
        body: 'r=' + postData
      })
      this.processSendRes(await res.json())
    } catch (err) {
      logger.error('err', err)
    }
  }

  async sendToDiscu(discuId, message) {
    if (!_.isString(message)) {
      throw new Error('[SMT] Unexpected message content. Expecting string.')
    }

    const postData = this.enrich({ did: discuId }, message)

    logger.info('[SMT] Sending discu message:', postData)
    try {
      let res = await Net.callApi('SEND_MESSAGE_TO_DISCUSS', { 
        body: 'r=' + postData
      })
      let ret = 
      this.processSendRes(await res.json())
    } catch (err) {
      logger.error('err', err)
    }
  }

  processSendRes(res) {
    logger.info('[SMT] Send message process completed with response:', res)

    if (res.errmsg) {
      logger.error('[SMT] Error:', res.errmsg)
      this.emit('sendFailed', res.errmsg)
    } else if (res.errCode === 0) {
      logger.info('[SMT] Message sent successfully.')
      this.emit('messageSent', res.msg)
    }
  }

  enrich(message, context) {
    Object.assign(message, {
      content: JSON.stringify([ context, ['font', { name: '宋体', size: 10, style: [ 0, 0, 0 ], color: '000000' }]]),
      face: 561,
      clientid: 53999199,
      msg_id: _.random(65950001, 75950001),
      psessionid: this.psessionid
    })

    return JSON.stringify(message)
  }
}
