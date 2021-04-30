import * as FC from 'folktale/concurrency'
import Axios from 'axios'
import fs from 'fs'
import util from 'util'
// noinspection ES6CheckImport
import R from 'ramda'

export const compose = R.compose
export const pick = R.pick
export const pickBy = R.pickBy
export const notNil = compose(R.not, R.isNil)
export const omitNil = pickBy(notNil)
export const prop = R.prop
export const propOr = R.propOr
export const path = R.path
export const pathOr = R.pathOr
export const tap = R.tap

export const Task = FC.task
export const tapTask = (f) => compose(Task.of, tap(f))
export const postTask = Task.fromPromised(Axios.post)

export const format = (m, color = false) => util.inspect(omitNil(m), false, 10, color).replace(/\n/g, '').replace(/\s{2,}/g, ' ')
export const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
export const mkdir = (path) => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK)
  } catch (err) {
    fs.mkdirSync(path, { recursive: true })
  }
}
