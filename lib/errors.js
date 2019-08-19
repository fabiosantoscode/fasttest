'use strict'

class ProtocolError extends Error {
  constructor (message, data = null, error = new.target.error || 'generic error', code = new.target.code || 500) {
    super(message)
    this.error = error
    this.code = code
    this.data = data
  }
  toJSON () {
    const { error, message, stack, data } = this
    const ret = {
      error,
      message,
      stacktrace: stack
    }
    if (data) ret.data = data
    return ret
  }
}

class InvalidArgument extends ProtocolError {
  static get error () { return 'invalid argument' }
  static get code () { return 400 }
}

class UnexpectedAlertOpen extends ProtocolError {
  static get error () { return 'unexpected alert open' }
  static get code () { return 500 }
}

class NoSuchWindow extends ProtocolError {
  static get error () { return 'no such window' }
  static get code () { return 404 }
}

class NoSuchElement extends ProtocolError {
  static get error () { return 'no such element' }
  static get code () { return 404 }
}

class StaleElementReference extends ProtocolError {
  static get error () { return 'stale element reference' }
  static get code () { return 404 }
}

class Timeout extends ProtocolError {
  static get error () { return 'timeout' }
  static get code () { return 408 }
}

class FasttestNotImplemented extends ProtocolError {
  static get error () { return '[fasttest]: not implemented' }
  static get code () { return 701 }
}

class JavascriptError extends ProtocolError {
  static get error () { return 'javascript error' }
  static get code () { return 500 }
}

Object.assign(exports, {
  ProtocolError,
  InvalidArgument,
  UnexpectedAlertOpen,
  NoSuchWindow,
  NoSuchElement,
  JavascriptError,
  StaleElementReference,
  Timeout,
  FasttestNotImplemented
})
