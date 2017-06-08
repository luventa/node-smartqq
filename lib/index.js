'use strict'

// import node modules.
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const EE3 = require('eventemitter3')
const Net = require('./utils/net')
const logger = require('./utils/logger').getInstance()

const DEFAULT_LOGIN_BODY = {
  clientid: 53999199,
  psessionid: '',
  status: 'online'
}

const MESSAGE_TYPES = ['message', 'group_message', 'discu_message']

module.exports = class SmartQQClient extends EE3 {
  constructor(opts) {
    super()
    Object.assign(this, opts)

    //bind event handlers
    this.on('connected', this.onConnected)
    this.on('timeout', this.onTimeout)
    this.on('message', this.onMessage)
    this.on('groupMessage', this.onGroupMessage)
    this.on('discuMessage', this.onDiscuMessage)
    this.on('fatal', this.onFatal)
  }

  async connect() {
    if (!await this._getQRCode()) {
      return false
    }
    await this._verifyQRCode()
  }

  disconnect() {
    clearInterval(this.pollJobId)
  }

  async onConnected() {
    await this._getPtwebqq(arguments)
    if (this.ptwebqq) {
      await this._getVfwebqq()
      await this._getUinAndPsessionid()
      this._pollMessage()
    }
  }

  onTimeout() {
    this._pollMessage()
  }

  onFatal() {
    throw new Error('[SMT] Fatal')
  }

  onMessage(message) {
    logger.info('[SMT] Message', message)
  }

  onGroupMessage(message) {
    logger.info('[SMT] Group message', message)
  }

  onDiscuMessage(message) {
    logger.info('[SMT] Discuss Message', message)
  }

  async _getQRCode() {
    try {
      logger.log('[SMT] Generating QR png for login process...')
      let res = await Net.callApi('GET_QR_CODE')
      res.body.pipe(fs.createWriteStream(path.resolve(this.qrpath, `./${this.qq}.png`)))
      this.qrsig = Net.getCookie(res.headers.get('set-cookie'), 'qrsig', true)
      logger.log('[SMT] QR png',  `${this.qq}.png`, 'is generated')
      return true
    } catch (err) {
      logger.error('err', err)
    }
  }

  async _verifyQRCode() {
    try {
      logger.log('[SMT] Wait user verify QR code...')
      let interval = setInterval(async () => {
        let res = await Net.callApi('VERIFY_QR_CODE', { params: [this.qrsig] })
        let body = await res.text()
        if (body.indexOf('成功') > -1) {
          let ret = body.split("','")
          if (ret.length > 2) {
            clearInterval(interval)
            logger.log('[SMT] QR code verified successfully.')
            this.checkurl = ret[2]
            this.emit('connected')
          } else {
            throw new Error('[SMT] Unexpected response for VERIFY_QR_CODE')
          }
        } else if (body.indexOf('已失效') > -1) {
          logger.log('[SMT] QR code is outdated.')
          await this._getQRCode()
        }
      }, 2000)
    } catch (err) {
      logger.error('[SMT] error', err)
    }
  }

  async _getPtwebqq() {
    try {
      logger.log('[SMT] Retrieving Web QQ infos...')
      let res = await Net.callApi('GET_PTWEBQQ', { params: [this.checkurl] })
      await Net.findoCookies('qq.com', '/', 'ptwebqq', (err, cookie) => {
        logger.log('[SMT] Got Web QQ info', cookie.value)
        this.ptwebqq = cookie.value
      })
    } catch (err) {
      logger.error('err', err)
    }
  }

  async _getVfwebqq() {
    try {
      logger.log('[SMT] Retrieving session infos...')
      let res = await Net.callApi('GET_VFWEBQQ', { params: [this.ptwebqq] })
      let ret = await res.json()
      this.vfwebqq = ret.result.vfwebqq
      logger.log('[SMT] Got session info', this.vfwebqq)
    } catch (err) {
      logger.error('err', err)
    }
  }

  async _getUinAndPsessionid() {
    try {
      let postData = Object.assign({ ptwebqq: this.ptwebqq }, DEFAULT_LOGIN_BODY)
      let res = await Net.callApi('GET_UIN_AND_PSESSIONID', { 
        body: 'r=' + JSON.stringify(postData)
      })
      let ret = await res.json()
      this.psessionid = ret.result.psessionid
      this.uin = ret.result.uin
    } catch (err) {
      logger.error('err', err)
    }
  }

  async _pollMessage() {
    let postData = {
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
      logger.log('[SMT] New message response incoming')
      
      if (ret.retcode === 0 && ret.error) {
        logger.log('[SMT] Timeout response, trigger onTimeout')
        this.emit('timeout')
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
        this._pollMessage()
      }
    } catch (err) {
      this.logger.error('err', err)
    }
  }
}
