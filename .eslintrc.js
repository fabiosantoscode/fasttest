module.exports = {
  extends: 'standard',
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
    mocha: true
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    TEST: false,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  rules: {
    'comma-dangle': 0,
  }
}
