const Axios = require('axios')
const FC = require('folktale/concurrency')
const fs = require('fs')
const R = require('ramda')
const util = require('util')

const compose = R.compose
const pick = R.pick
const pickBy = R.pickBy
const notNil = compose(R.not, R.isNil)
const omitNil = pickBy(notNil)
const prop = R.prop
const propOr = R.propOr
const path = R.path
const pathOr = R.pathOr
const tap = R.tap
const Task = FC.task
const tapTask = (f) => compose(Task.of, tap(f))
const postTask = Task.fromPromised(Axios.post)
const format = (m, color = false) => util.inspect(m, false, 10, color).replace(/\n/g, '').replace(/\s{2,}/g, ' ')
const mkdir = (path) => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK)
  } catch (err) {
    fs.mkdirSync(path, { recursive: true })
  }
}

module.exports = {
  compose, pick, pickBy, notNil, omitNil, prop, propOr, path, pathOr, tap, Task, tapTask, postTask, format, mkdir,
}
