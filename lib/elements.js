'use strict'

const assert = require('assert')
const errors = require('./errors.js')

function createElementStore ({ context }) {
  const store = new Map()
  const elmSet = new WeakSet()
  function memorize (element) {
    const id = Math.random().toString(16).slice(2)
    if (elmSet.has(element)) {
      for (const [id, elm] of store) {
        if (elm === element) return id
      }
      assert(false)
    }
    elmSet.add(element)
    store.set(id, element)
    return id
  }
  function get (reference, { connected = false } = {}) {
    const result = store.get(reference)
    if (!result) {
      throw new errors.NoSuchElement('Could not find element with reference ' + reference)
    }
    if (connected && !result.isConnected) {
      throw new errors.StaleElementReference('Element with reference ' + reference + ' is not connected to a document or shadow root')
    }
    return result
  }
  function lookup ({ using, value }, base, isPlural = false) {
    base = base || context.document.documentElement
    if (using !== 'css selector') throw new errors.FasttestNotImplemented('Not implemented: selecting elements with ' + JSON.stringify(using))
    const elms = base.querySelectorAll(value)
    if (isPlural) {
      return [].slice.call(elms)
    }
    if (!elms[0]) {
      throw new errors.NoSuchElement('Could not find element with ' + using + ' ' + value)
    }
    return elms[0]
  }
  const elements = {
    memorize,
    get,
    lookup
  }
  return elements
}

// TODO process stale elements

Object.assign(exports, {
  createElementStore,
})
