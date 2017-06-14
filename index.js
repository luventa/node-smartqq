const SMQ  = require('./lib')

module.exports = {
  createClient: (config) =>  {
    return new SMQ(config)
  }
}
