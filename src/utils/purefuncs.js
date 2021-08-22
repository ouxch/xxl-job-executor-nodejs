const Axios = require('axios')
const FC = require('folktale/concurrency')
const fs = require('fs')
const R = require('ramda')
const Path = require('path')
const { execFile, spawnSync } = require('child_process')
const FGets = require('qfgets')

const last = R.last
const compose = R.compose
const pick = R.pick
const pickBy = R.pickBy
const prop = R.prop
const propOr = R.propOr
const path = R.path
const pathOr = R.pathOr
const tap = R.tap
const not = R.not
const isNil = R.isNil
const isEmpty = R.isEmpty
const Task = FC.task

const notEmpty = compose(not, isEmpty())
const notNil = compose(not, isNil)
const omitNil = pickBy(notNil)
const isNilOrEmpty = (x) => isNil(x) || isEmpty(x)
const tapTask = (f) => compose(Task.of, tap(f))
const postTask = Task.fromPromised(Axios.post)
const mkdir = (path) => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK)
  } catch (err) {
    fs.mkdirSync(path, { recursive: true })
  }
}

const appendExecutePermission4Grep = () => {
  const absolutePath = Path.resolve(__dirname, './grep-log.sh')
  const stats = fs.statSync(absolutePath, { bigint: false, throwIfNoEntry: false })
  if (stats) fs.chmodSync(absolutePath, (stats.mode | parseInt('111', 8)))
}

const grepVersion = () => {
  const { stdout, stderr, error } = spawnSync('grep', [ '-V' ])
  if (stderr || error) return false
  return stdout
}

const grepFile = (filePath, content) => new Promise((resolve, reject) =>
  execFile(Path.resolve(__dirname, './grep-log.sh'), [ filePath, `${content.replace(/-/ig, '\\-')}` ], (error, stdout, stderr) =>
    (error || stderr) ? reject(error || stderr) : resolve(stdout)))

const grepWithQFGets = (filePath, content, endContent) => new Promise((resolve, reject) => {
  const done = (err, result) => err ? reject(err) : resolve(result)
  const fp = new FGets(filePath)
  const reg = content ? new RegExp(content, 'i') : undefined
  const endReg = endContent ? new RegExp(endContent, 'i') : undefined
  let contents = ''
  const readLines = () => {
    try {
      for (let i = 0; i < 50; i++) {
        const content = fp.fgets()
        if (!content) continue
        if (reg && content.match(reg)) contents += content
        if (endReg && content.match(endReg)) done(undefined, contents)
      }
      if (fp.feof()) done(undefined, contents)
      else setImmediate(readLines)
    } catch (err) {
      done(err)
    }
  }
  readLines()
})

module.exports = {
  last,
  compose,
  pick,
  pickBy,
  prop,
  propOr,
  path,
  pathOr,
  tap,
  not,
  isNil,
  isEmpty,
  Task,
  notEmpty,
  notNil,
  omitNil,
  isNilOrEmpty,
  tapTask,
  postTask,
  mkdir,
  appendExecutePermission4Grep,
  grepVersion,
  grepFile,
  grepWithQFGets,
}
