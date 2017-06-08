'use strict'

const _ = require('lodash')
const tough = require('tough-cookie')
const cookieJar = new tough.CookieJar()
const fetch = require('fetch-cookie/node-fetch')(require('node-fetch'), cookieJar)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36'
const APIs = require('../config/apis.json')

const getOptions = (api, opts) => {
  let options = Object.assign({ headers: {} }, opts)
  options.headers['User-Agent'] = USER_AGENT

  if(api.method === 'POST') {
    options.method = api.method
  }

  if (api.referer) {
    options.headers['Referer'] = api.referer
  }

  if (api.origin) {
    options.headers['Origin'] = api.origin
  }

  return options
}

const getApi = (name, opts) => {
  if (_.isUndefined(name) || _.isUndefined(APIs[name])) {
    throw new Error('[SMQ] Api name invalid!')
  }

  let api = _.cloneDeep(APIs[name])
  if (_.isPlainObject(opts) && _.isArray(opts.params)) {
    opts.params.forEach((param, index) => {
      api.url = api.url.replace(`{${index}}`, param)
    })
    delete opts.params
  }
  return api
}

module.exports = class Net {
  static callApi(name, opts) {
    let api = getApi(name, opts)
    let options = getOptions(api, opts)

    return fetch(api.url, options)
  }

  static getCookie(cookies, key, hash = false) {
    let arr = cookies.match(new RegExp(`(^| )${key}=([^;]*)(;|$)`))
    
    if (!_.isArray(arr) || arr.length <= 2) {
      return null
    }

    if (!hash) {
      return arr[2]
    }

    let origin = arr[2]
    let ret = 0

    for (let i = 0, n = origin.length; n > i; ++i) {
      ret += (ret << 5) + origin.charCodeAt(i)
    }

    return 2147483647 & ret
  }

  static findoCookies(domain, path, key, cb) {
    if (cookieJar) {
      return cookieJar.store.findCookie(domain, path, key, cb)
    }
    
    return null
  }
}
