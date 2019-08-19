'use strict'

const assert = require('assert').strict

describe('session', () => {
  let session
  let exec
  beforeEach(async () => {
    session = await TEST.makeSession({ initialUrl: 'about:blank' })
    exec = session.execute
  })
  afterEach(() => {
    if (session) {
      session.close()
      session = null
    }
  })

  describe('(session management)', () => {
    it('can close a session', (done) => {
      const zombieWindow = session.context.window // Window won't be garbage collected
      zombieWindow.eval('setTimeout(() => { window._foo = "i should never exist" })')
      session.close()
      setTimeout(() => {
        assert.equal(zombieWindow._foo, undefined)
        done()
      })
    })
  })

  describe('timeouts', () => {
    // https://www.w3.org/TR/webdriver1/#dfn-get-timeouts
    it('GET /timeouts', async () => {
      assert.deepStrictEqual(await exec('GET', '/timeouts'), {
        script: 30 * 1000,
        pageLoad: 300 * 1000,
        implicit: 0,
      })
    })
    it('POST /timeouts', async () => {
      assert.deepStrictEqual(await exec('POST', '/timeouts', {
        script: 30 * 1000,
        pageLoad: 300 * 1000,
        implicit: 0,
      }), null)
    })
  })

  describe('navigation', () => {
    it('(sessions accept initial URL)', async () => {
      const session = await TEST.makeSession({ initialUrl: 'https://example.com' })
      assert.equal(session.context.history.entries.length, 1)
      assert.equal(session.context.window.location.href, 'https://example.com/')
    })
    // https://www.w3.org/TR/webdriver1/#navigation
    it('POST /url', async () => {
      await exec('POST', '/url', { url: 'https://example.com' })
      assert.equal(await exec('GET', '/url'), 'https://example.com/')
    })
    it('GET /url', async () => {
      assert.equal(await exec('GET', '/url'), 'about:blank')
    })
    it('POST /back', async () => {
      await exec('POST', '/url', { url: 'https://example.com/1' })
      await exec('POST', '/url', { url: 'https://example.com/2' })
      await exec('POST', '/back')
      assert.equal(await exec('GET', '/url'), 'https://example.com/1')
      await exec('POST', '/back')
      assert.equal(await exec('GET', '/url'), 'about:blank')
    })
    it('POST /forward', async () => {
      await exec('POST', '/url', { url: 'https://example.com/1' })
      await exec('POST', '/url', { url: 'https://example.com/2' })
      await exec('POST', '/back')
      await exec('POST', '/back')
      assert.equal(await exec('GET', '/url'), 'about:blank')
      await exec('POST', '/forward')
      assert.equal(await exec('GET', '/url'), 'https://example.com/1')
      await exec('POST', '/forward')
      assert.equal(await exec('GET', '/url'), 'https://example.com/2')
    })
    it('POST /refresh', async () => {
      session.context.window.eval('window.testThree = 3')
      assert.equal(session.context.window.testThree, 3, 'sanity check')
      await exec('POST', '/refresh')
      assert.equal(session.context.window.testThree, undefined)
    })
    it('GET /title', async () => {
      assert.equal(session.context.document.title, '', 'sanity check')
      session.context.document.title = 'test title'
      assert.equal(await exec('GET', '/title'), 'test title')
    })
    it('GET /title of a known page', async () => {
      await exec('POST', '/url', { url: 'https://example.com' })
      assert.equal(await exec('GET', '/title'), 'Example Domain')
    })
  })

  describe('window.open()', () => {
    it('opens a popup or tab', async () => {
      session.context.window.eval('window.open("http://example.com")')
      const newContext = session.contexts[1]
      assert.deepEqual(await exec('GET', '/window/handles'), ['test-context', newContext.handle])
    })
    it('returns a handle where the new popup or tab can be controlled')
    it('does not support non-blank targets', () => {
      session.context.window.eval('window.open("http://example.com", "_blank")')
      assert.throws(() => session.context.window.eval('window.open("http://example.com", "some-frame-name")'))
    })
  })

  describe('command contexts', () => {
    it('GET /window', async () => {
      assert.equal(await exec('GET', '/window'), 'test-context')
    })
    it('DELETE /window', async () => {
      assert.deepEqual(await exec('DELETE', '/window'), [])
    })
    it('POST /window', async () => {
      session.context.window.eval(`window.open("https://example.com")`)
      await exec('POST', '/window', { handle: session.contexts[1].handle })
      assert.equal(session.context, session.contexts[1])
    })
    it('GET /window/handles', async () => {
      assert.deepEqual(await exec('GET', '/window/handles'), ['test-context'])
    })
    // TODO "switch to frame" (10.5) up until 11 (non-inclusive)
  })

  describe('retrieving elements', () => {
    it('POST /element', async () => {
      return // TODO
      const elm = session.context.document.querySelector('h1')
      const res = await exec('POST', '/element')

      console.log({ res })
    })
  })

  describe('interacting with elements', () => {
    // TODO somehow position elements and take their position into account when retrieving and interacting
  })

  // TODO stuff between 12 and 15.2.1 (non-inclusive)
  describe('executing script', () => {
    it('POST /execute/sync', async () => {
      const res = await exec('POST', '/execute/sync', {
        script: 'return arguments[0] + " " + arguments[1] + " " + 42',
        args: ['test', 'foo']
      })
      assert.equal(res, 'test foo 42')
    })
    it('POST /execute/async', async () => {
      const res = await exec('POST', '/execute/async', {
        script: 'arguments[1](arguments[0])',
        args: ['async!']
      })
      assert.equal(res, 'async!')
    })
  })
})
