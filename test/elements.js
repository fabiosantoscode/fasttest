'use strict'

const assert = require('assert').strict
const { NoSuchElement, StaleElementReference } = require('../lib/errors.js')

describe('elements', () => {
  let elements
  let documentElement
  let session
  beforeEach(async () => {
    session = await TEST.makeSession({ initialUrl: 'https://example.com/test-elements' })
    elements = session.context.elements
    documentElement = session.context.document.documentElement
  })

  it('can commit elements to memory', TEST.withFakeRandom([0.5], () => {
    const element = documentElement.querySelector('#test-input')
    assert(element, 'sanity check')
    const pointFiveInHex = '8'
    assert.deepEqual(elements.memorize(element), pointFiveInHex)
    assert.strictEqual(elements.get('8'), element)
  }))

  it('can memorize the same element twice and will get the same element', () => {
    const element = documentElement.querySelector('#test-input')
    const id = elements.memorize(element)
    assert.equal(id, elements.memorize(element))
  })

  it('throws when an element is not found', () => {
    assert.throws(() => elements.get('no-such-element'), NoSuchElement)
  })

  it('when { connected: true } is given, get() throws when the element is not connected', () => {
    const elm = documentElement.querySelector('#test-p')
    const id = elements.memorize(elm)
    elm.remove()
    assert.throws(() => elements.get(id, { connected: true }), StaleElementReference)
  })

  describe('elements.lookup({ using, value }, base, isPlural)', () => {
    it('returns a list of elements', () => {
      const result = elements.lookup({ using: 'css selector', value: 'p' }, null, true)
      const expected = documentElement.querySelectorAll('p')
      assert.equal(result.length, expected.length)
      for (let i = 0; i < result.length; i++) {
        assert.equal(result[i], expected[i])
      }
    })
    it('returns a single element', () => {
      const result = elements.lookup({ using: 'css selector', value: 'p' }, null, false)
      const expected = documentElement.querySelector('p')
      assert.equal(result, expected)
    })
    it('can query from a base', () => {
      const form = documentElement.querySelector('form')
      const expected = form.querySelector('p')
      const result = elements.lookup({ using: 'css selector', value: 'p' }, form, false)
      assert.equal(result, expected)
    })
  })
})
