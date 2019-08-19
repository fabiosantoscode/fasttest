'use strict'

const { VirtualConsole } = require('jsdom')
const testPages = require('../test-pages')
const makeSession = require('../lib/session.js')

global.TEST = {
  makeSession: async (options = {}) => {
    const virtualConsole = new VirtualConsole()
    virtualConsole.emitFasttest = false
    virtualConsole.sendTo(console)
    const testFetch = async (url, options) => {
      if (testPages[url]) {
        return testPages[url]
      }
      throw new Error('Choosing not to do a fetch during testing: ' + url)
    }
    const session = await makeSession({ ...options, virtualConsole, fetch: testFetch })
    session.context.handle = 'test-context'
    return session
  },
  withFakeRandom: (outputs, fn) => async () => {
    const outputsQueue = outputs.slice().reverse()
    const random = Math.random
    Math.random = () => {
      if (outputsQueue.length) {
        return outputsQueue.pop()
      }
      throw new Error('Ran out of Math.random() outputs in list: ' + JSON.stringify(outputs))
    }
    try {
      return fn()
    } finally {
      Math.random = random
    }
  }
}
