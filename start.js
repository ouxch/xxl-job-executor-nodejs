// Transpile all code following this line with babel and use 'env' (aka ES6) preset.
// noinspection JSValidateTypes
require('babel-register')({
  presets: ['env'],
  plugins: ['transform-object-rest-spread', 'transform-runtime'],
})

require('dotenv').config()

// Import the rest of our application.
module.exports = require('./src/index.js')
