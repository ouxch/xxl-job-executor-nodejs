const Axios = require('axios')
const FC = require('folktale/concurrency')
const R = require('ramda')

const always = R.always
const anyPass = R.anyPass
const last = R.last
const compose = R.compose
const pick = R.pick
const propOr = R.propOr
const path = R.path
const pathOr = R.pathOr
const reject = R.reject
const tap = R.tap
const not = R.not
const isNil = R.isNil
const isEmpty = R.isEmpty
const Task = FC.task

const notEmpty = compose(not, isEmpty)
const omitNil = reject(isNil)
const isNilOrEmpty = anyPass([isNil, isEmpty])
const tapTask = (f) => compose(Task.of, tap(f))
const postTask = Task.fromPromised(Axios.post)

module.exports = {
  always, last, compose, pick, propOr, path, pathOr, tap, not, isNil, isEmpty, Task, notEmpty, omitNil,
  isNilOrEmpty, tapTask, postTask,
}
