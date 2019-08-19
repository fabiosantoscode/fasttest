
module.exports = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Test elements</title>
    </head>
    <body>
      <main id="main">
        <p id="test-p" class="test-p">test paragraph</p>
        <p id="test-p-2" class="test-p-2">test paragraph 2</p>
      </main>
      <form method="GET" action="/test-elements">
        <p id="test-p-3">test paragraph 3</p>
        <label id="test-label" for="test-input">test label</label>
        <input id="test-input" value="initial value">

        <label id="test-label-2" for="test-textarea">test label 2</label>
        <textarea id="test-textarea"><p>hy</p></textarea>
      </form>
    </body>
  </html>
`
