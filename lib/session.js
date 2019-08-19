'use strict'

const assert = require('assert')
const fetch = require('node-fetch')
const { JSDOM, VirtualConsole } = require('jsdom')
const { createElementStore } = require('./elements.js')
const FasttestResourceLoader = require('./resource-loader.js')

const CONSOLE_EVENT_NAMES = ['error', 'warn', 'info', 'dir', 'jsdomError', 'fasttest']

const {
  InvalidArgument,
  ProtocolError,
  FasttestNotImplemented,
  JavascriptError,
  UnexpectedAlertOpen,
  NoSuchWindow,
  Timeout
} = require('./errors')

const jsonParse = text => {
  if (typeof text !== 'string') return text // For testing
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new InvalidArgument(e.message)
  }
}

const fetchInitialHTML = async ({ url, referrer, fetch: customFetch }) => {
  if (url === 'about:blank') {
    return ''
  }
  const defaultFetcher = (url) => fetch(url).then(res => res.text())
  return customFetch(url, { _initialFetch: true }, defaultFetcher)
}

async function createJsdom ({ url, referrer, virtualConsole, fetch, session }) {
  const jsdom = new JSDOM(await fetchInitialHTML({ url, referrer, fetch }), {
    url,
    referrer,
    runScripts: 'dangerously',
    resources: new FasttestResourceLoader(fetch),
    beforeParse (window) {
      window.FASTTEST = true
      window.open = (...args) => { session.openNewContext(...args) }
    },
    virtualConsole
  })
  return jsdom
}

const createBrowserContext = ({ url: initialUrl, parent, session, virtualConsole, fetch }) => {
  const history = {
    index: 0,
    entries: [
      { url: initialUrl }
    ],
    navigate: async (url, doPush = true) => {
      assert(context.isTopLevel, 'trying to navigate a non-toplevel context is not supported')
      let index = history.index
      if (typeof url === 'number') {
        assert(doPush)
        index = history.index + url
        const entry = history.entries[index]
        if (!entry) return
        url = entry.url
        history.index = index
      } else if (doPush) {
        history.index++
        history.entries = history.entries.slice(0, history.index).concat({ url })
      } else {
        history.entries[history.entries.length - 1].url = url
      }
      if (context.jsdom) {
        context.jsdom.window.close()
      }
      context.jsdom = await createJsdom({ url, virtualConsole, fetch, session })
    }
  }
  const context = {
    handle: Math.random().toString(16).slice(2),
    parent,
    get isTopLevel () { return !context.parent },
    open: true,
    history,
    close: () => {
      if (context.jsdom) context.jsdom.window.close()
      context.open = false
    },
    get window () {
      return context.jsdom.window
    },
    get document () {
      return context.jsdom.window.document
    },
  }
  const elements = createElementStore({ context })
  context.elements = elements
  return context
}

const createSession = async ({ virtualConsole, fetch, initialUrl }) => {
  let context = null
  let contexts = []
  const topLevelContext = () => {
    let cur = context
    while (cur.parent) {
      cur = cur.parent
    }
    return cur
  }
  const openTopLevelContext = () => {
    const ctx = topLevelContext()
    if (!ctx.open) {
      throw new NoSuchWindow('top-level context is no longer open')
    }
    return ctx
  }

  async function timeoutExec (timeout, timeoutDescription, fn) {
    let timeoutHandle
    try {
      const result = await Promise.race([
        fn(),
        new Promise((resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Timeout(timeoutDescription))
          }, timeouts.pageLoad)
        })
      ])
      return result
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  function close () {
    contexts.forEach(ctx => ctx.close())
  }

  function openNewContext (url, target = '_blank', windowFeatures = null) {
    if (target !== '_blank') throw new FasttestNotImplemented('window.open() second argument must be omitted or "_blank"')
    if (windowFeatures) throw new FasttestNotImplemented('window.open() third argument is not supported')

    const newContext = createBrowserContext({ url, parent: null, session, virtualConsole, fetch })
    contexts.push(newContext)
    return newContext
  }

  function switchToContext (ctx) {
    context = ctx
  }

  const session = {
    id: Math.random().toString(16).slice(2),
    execute,
    get context () {
      return context
    },
    get contexts () {
      return contexts
    },
    close,
    openNewContext
  }

  let userPrompts = []

  const handleUserPrompts = () => null

  const routes = []

  const route = (meth, path, fn) => {
    routes.push({ meth, path: new RegExp('^' + path + '$'), fn })
  }

  async function execute (method, reqPath, body) {
    for (const { meth, path, fn } of routes) {
      if (method === meth && path.test(reqPath)) {
        virtualConsole.fasttest(method, reqPath, ...(body ? [body] : []))
        const match = (reqPath.match(path) || ['']).slice(1)
        return fn(...match, body ? jsonParse(body) : null)
      }
    }
    throw new ProtocolError('Unknown command or method ' + method + ' ' + reqPath, null, 'unknown command', 404)
  }

  const timeouts = {
    script: 30 * 1000,
    pageLoad: 300 * 1000,
    implicit: 0
  }

  route('GET', '/timeouts', () => timeouts)

  route('POST', '/timeouts', (body) => {
    body = jsonParse(body)
    for (const [name, value] of Object.entries(body)) {
      if (!(name in timeouts)) {
        throw new InvalidArgument('unknown timeout ' + name)
      }
      if (value !== Math.round(value) || isNaN(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
        throw new InvalidArgument('invalid timeout for ' + name + ' ' + value)
      }
    }
    for (const [name, value] of Object.entries(body)) {
      timeouts[name] = value
    }
    return null
  })

  route('POST', '/url', async ({ url }) => {
    const ctx = openTopLevelContext()
    const currentUrl = ctx.jsdom.window.location.href
    if (url !== currentUrl) {
      await timeoutExec(
        timeouts.pageLoad,
        'Timed out while trying to load ' + url,
        () => ctx.history.navigate(url)
      )
      return null
    }
  })

  route('GET', '/url', async () => {
    const ctx = openTopLevelContext()
    await handleUserPrompts()
    return ctx.window.location.href
  })

  route('POST', '/back', async () => {
    const ctx = openTopLevelContext()
    await handleUserPrompts()
    await ctx.history.navigate(-1)
  })

  route('POST', '/forward', async () => {
    const ctx = openTopLevelContext()
    await handleUserPrompts()
    await ctx.history.navigate(1)
  })

  route('POST', '/refresh', async () => {
    const ctx = openTopLevelContext()
    await handleUserPrompts()
    await ctx.history.navigate(0)
  })

  route('GET', '/title', async () => {
    const ctx = openTopLevelContext()
    await handleUserPrompts()
    return ctx.document.title
  })

  route('GET', '/window', async () => {
    const ctx = openTopLevelContext()
    return ctx.handle
  })

  route('DELETE', '/window', async () => {
    const ctx = openTopLevelContext()
    assert(contexts.indexOf(ctx) !== -1)
    await handleUserPrompts()
    contexts = contexts.filter(c => c !== ctx)
    return session.execute('GET', '/window/handles')
  })

  route('POST', '/window', async ({ handle }) => {
    if (!handle) throw new InvalidArgument('Selected handle is ' + handle)
    if (userPrompts.length) throw new UnexpectedAlertOpen('Cannot change windows when there is an open alert')
    const ctx = contexts.find(c => c.handle === handle)
    if (!ctx) throw new NoSuchWindow('Could not find a window with handle ' + handle)
    switchToContext(ctx)
  })

  route('GET', '/window/handles', async () => {
    const contextHandles = []
    contexts.forEach(ctx => {
      if (ctx.isTopLevel) {
        contextHandles.push(ctx.handle)
      }
    })
    return contextHandles
  })

  route('POST', '/frame', () => { throw new FasttestNotImplemented() })
  route('POST', '/frame/parent', () => { throw new FasttestNotImplemented() })

  route('GET', '/window/rect', () => { throw new FasttestNotImplemented() })
  route('POST', '/window/rect', () => { throw new FasttestNotImplemented() })
  route('POST', '/window/maximize', () => { throw new FasttestNotImplemented() })
  route('POST', '/window/minimize', () => { throw new FasttestNotImplemented() })
  route('POST', '/window/fullscreen', () => { throw new FasttestNotImplemented() })

  function promiseCall (f, ...args) {
    try {
      return Promise.resolve(f(...args))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  function cloneObject (value, seen, cloneAlgorithm) {
    // TODO here we must check if it's a NodeList, HTMLCollection or Array,
    // not just whether it has a length.
    const result = typeof value.length === 'number' ? [].slice.call(value) : {}
    for (const k of Object.keys(value)) {
      let v
      try {
        v = value[k]
      } catch (e) {
        throw new JavascriptError('An error has occurred trying to get property ' + k + ' from an object: ' + e.message)
      }
      result[k] = cloneAlgorithm(v)
    }
    return result
  }

  function jsonDeserialize (value, seen = []) {
    // TODO full spec compliance
    if (value == null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value
    }
    return cloneObject(value, seen, jsonDeserialize)
  }

  function extractScriptArguments ({ script, args }) {
    // TODO full spec compliance https://www.w3.org/TR/webdriver1/#dfn-extract-the-script-arguments-from-a-request
    if (typeof script !== 'string') throw new InvalidArgument('script must be a string. It is ' + typeof string + '.')
    if (!Array.isArray(args)) throw new InvalidArgument('args must be an array.')
    args = jsonDeserialize(args)
    return { body: script, args }
  }

  function tryToParseBody (body) {
    try {
      /* eslint-disable-next-line */
      new Function(body)
    } catch (e) {
      throw new JavascriptError(e.message)
    }
  }

  function executeFunctionBody (args, body) {
    tryToParseBody(body)
    let contents = '__$__fasttestArguments' + Math.random().toString(16).slice(2)
    context.jsdom.window[contents] = args
    try {
      return context.jsdom.window.eval(`(function(){${body}}).apply(this, this.${contents})`)
    } finally {
      delete context.jsdom.window[contents]
    }
  }

  route('POST', '/execute/sync', async (scriptParams) => {
    const { args, body } = extractScriptArguments(scriptParams)
    const result = await timeoutExec(
      timeouts.script,
      'Timed out running script ' + body,
      () => promiseCall(executeFunctionBody, args, body)
    )

    return result
  })

  route('POST', '/execute/async', async (scriptParams) => {
    const { args, body } = extractScriptArguments(scriptParams)
    const createPromise = () => new Promise((resolve, reject) => {
      promiseCall(executeFunctionBody, args.concat([resolve]), body).catch(reject)
    })
    const result = await timeoutExec(
      timeouts.script,
      'Timed out running script ' + body,
      createPromise
    )

    return result
  })

  switchToContext(openNewContext(initialUrl))

  await context.history.navigate(initialUrl, false)

  return session
}

module.exports = async ({ virtualConsole = new VirtualConsole(), initialUrl = 'about:blank', fetch } = {}) => {
  assert(fetch, 'no fetch function given')
  virtualConsole.fasttest = (...args) => {
    if (virtualConsole.emitFasttest) virtualConsole.emit('fasttest', ...args)
  }
  CONSOLE_EVENT_NAMES.forEach(event => {
    virtualConsole.on(event, (...args) => {
      let logMethod = event
      if (logMethod === 'jsdomError') {
        logMethod = 'error'
        args = ['JSDOM ERROR:'].concat(args)
      }
      if (logMethod === 'fasttest') {
        logMethod = 'info'
        args = ['[fasttest]:'].concat(args)
      }
      console[logMethod](...args)
    })
  })
  return createSession({ virtualConsole, initialUrl, fetch })
}
