const SMQ  = require('./lib')
const logger = require('./lib/utils/logger').getInstance()

module.exports = {
  createClient: (opts = {
    qq: 'unknown',
    qrpath: __dirname
  }) =>  {
    return new SMQ(opts)
  }
}
