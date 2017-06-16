'use strict'

// import node modules.
const _ = require('lodash')
const Net = require('./utils/net')
const logger = require('./utils/logger').getInstance()

module.exports = class Finder {
  constructor() {
  }

  setContext(context) {
    Object.assign(this, _.pick(context, ['ptwebqq', 'vfwebqq', 'psessionid']))
  }

  async getUserInfo(uin) {
    logger.log('[SMT] Trying to get User Info for uin', uin)
    try {
      const res = await Net.callApi('GET_FRIEND_INFO', { 
        params: [uin, this.vfwebqq, this.psessionid]
      })
      return await res.json()
    } catch (err) {
      this.logger.error('err', err)
    }
  }
}
