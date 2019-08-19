const assert = require('assert')
const { ResourceLoader } = require('jsdom')

function thenCopy (req, thenFn, catchFn) {
  const reqCopy = new Promise((resolve, reject) => {
    req.then(thenFn, catchFn).then(resolve, reject)
  })
  for (const k in req) {
    reqCopy[k] = req[k]
  }
  reqCopy.then((res) => {
    reqCopy.FOO = 'bar'
  })
  return reqCopy
}

class FasttestResourceLoader extends ResourceLoader {
  constructor (fetch) {
    super()
    this.customFetch = fetch
  }
  fetch (url, options) {
    if (this.customFetch) {
      return this.customFetch(url, options, (url, options) => Promise.resolve(super.fetch(url, options)))
    }
    return Promise.resolve(super.fetch(url, options))
  }
}

module.exports = FasttestResourceLoader
