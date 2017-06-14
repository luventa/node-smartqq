'use strict'

// import node modules.
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const EE3 = require('eventemitter3')
const Net = require('./utils/net')
const logger = require('./utils/logger').getInstance()

const DEFAULT_CONFIG = {
  qq: 'unknown',
  qrpath: __dirname
}

const CUSTOM_EVENTS = ['outdated', 'disconnected']

const sleep = (ms) => {
  const exitTime = _.now() + ms
  while (_.now() < exitTime) {
  }
}

module.exports = class Connector extends EE3 {
  constructor(config) {
    super()
    this._context = {}
    Object.assign(this, DEFAULT_CONFIG, _.pick(config, ['qq', 'qrpath']))
  }

  // properties
  get isConnected() {
    console.log(this._context.qrsig)
    if (this._context && this._context.qrsig) {
      return true
    } else {
      return false
    }
  }

  get isLogin() {
    if (this._context && this._context.psessionid && this._context.uin && this._context.vfwebqq) {
      return true
    } else {
      return false
    }
  }

  get context() {
    return this._context
  }

  // methods
  async connect() {
    await this._getQRCode()
    await this._verifyQRCode()
    await this._getPtwebqq()
    await this._getVfwebqq()
    await this._getUinAndPsessionid()
    if (this.isLogin) {
      logger.log('[SMT] Connection is ready.')
      this.emit('ready')
    }
  }

  disconnect() {
    this._context = undefined
    this.emit('disconnected')
  }

  async _getQRCode() {
    try {
      logger.log('[SMT] Generating QR png for login process...')
      let res = await Net.callApi('GET_QR_CODE')
      res.body.pipe(fs.createWriteStream(path.resolve(this.qrpath, `./${this.qq}.png`)))
      logger.log('[SMT] QR png',  `${this.qq}.png`, 'is generated')
      this._context.qrsig = Net.getCookie(res.headers.get('set-cookie'), 'qrsig', true)
      logger.log('[SMT] QR signature',  this._context.qrsig)      
    } catch (err) {
      logger.error('[SMT]', err)
      throw new Error('[SMT] Cannot get QRCode for login')
    }
  }

  async _verifyQRCode() {
    try {
      logger.log('[SMT] Wait user verify QR code...')

      if (!this._context.qrsig) {
        throw new Error('[SMT] QR signature is not generated')
      }

      while(!this._context.checkurl) {
        logger.info('[SMT] Wait for user to verify QRCode')
        // call api to verify QRCode
        const res = await Net.callApi('VERIFY_QR_CODE', {
          params: [this._context.qrsig]
        })

        // get body outof response
        const body = await res.text()

        // check body
        if (body.indexOf('成功') > -1) {
          const ret = body.split("','")

          if (ret.length > 2) {
            logger.log('[SMT] QR code verified successfully.')

            // get check url for the next step
            this._context.checkurl = ret[2]
            return false
          } else {
            throw new Error('[SMT] Unexpected response for VERIFY_QR_CODE')
          }

        } else if (body.indexOf('已失效') > -1) {
          logger.log('[SMT] QR code is outdated.')
          await this._getQRCode()
          this.emit('outdated')
        }

        sleep(2000)
      }

    } catch (err) {
      logger.error('[SMT]', err)
      throw new Error('[SMT] Cannot verify QRCode for login')
    }
  }

  async _getPtwebqq() {
    try {
      logger.log('[SMT] Retrieving ptwebqq...')

      if (!this._context.checkurl) {
        throw new Error('[SMT] Check url is not generated')
      }

      const res = await Net.callApi('GET_PTWEBQQ', {
        params: [this._context.checkurl]
      })

      await Net.findoCookies('qq.com', '/', 'ptwebqq', (err, cookie) => {
        if (err) {
          logger.error('[SMT]', err)
        } else {
          logger.log('[SMT] Got ptwebqq', cookie.value)
          this._context.ptwebqq = cookie.value
        }
      })

    } catch (err) {
      logger.error('[SMT]', err)
    }
  }

  async _getVfwebqq() {
    try {
      logger.log('[SMT] Retrieving vfwebqq...')

      if (!this._context.ptwebqq) {
        throw new Error('[SMT] PT web qq is not generated')
      }

      const res = await Net.callApi('GET_VFWEBQQ', {
        params: [this._context.ptwebqq]
      })

      const ret = await res.json()
      this._context.vfwebqq = ret.result.vfwebqq
      logger.log('[SMT] Got vfwebqq', this._context.vfwebqq)

    } catch (err) {
      logger.error('[SMT]', err)
    }
  }

  async _getUinAndPsessionid() {
    try {
      logger.log('[SMT] Retrieving uin and session id...')

      if (!this._context.ptwebqq) {
        throw new Error('[SMT] PT web qq is not generated')
      }

      const postData = {
        clientid: 53999199,
        psessionid: '',
        status: 'online',
        ptwebqq: this._context.ptwebqq
      }

      const res = await Net.callApi('GET_UIN_AND_PSESSIONID', { 
        body: 'r=' + JSON.stringify(postData)
      })

      const ret = await res.json()

      this._context.psessionid = ret.result.psessionid
      logger.log('[SMT] Got session id', this._context.psessionid)
      this._context.uin = ret.result.uin
      logger.log('[SMT] Got uin', this._context.uin)

    } catch (err) {
      logger.error('[SMT]', err)
    }
  }
}
