import config from '@src/config'
import fs from 'fs'
import logger from '@src/utils/logger'
import moment from 'moment'
import Router from '@koa/router'
import { addJob, ifRunning } from '@src/executor/job-manager'
import { pathOr, pick, propOr } from '@src/utils/purefuncs'

const log = logger('executor')
const { jobLogDir } = config

const beat = async (ctx) => ctx.body = { code: 200, msg: 'online' }
const idleBeat = async (ctx) => {
  const jobId = pathOr(-1, ['request', 'body', 'jobId'], ctx)
  ctx.body = ifRunning(jobId) ? { code: 500, msg: 'busy' } : { code: 200, msg: 'idle' }
}
const runJob = async (ctx) => {
  const jobCtx = pick(
    ['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'],
    pathOr({}, ['request', 'body'], ctx))
  try {
    addJob(jobCtx)
    ctx.body = { code: 200, msg: 'success' }
  } catch (err) {
    ctx.body = { code: 500, msg: propOr(err.toString(), 'message', err) }
  }
}
const killJob = async (ctx) => ctx.body = { code: 200, msg: 'not yet support kill' }
const readLog = async (ctx) => {
  const { logDateTim, logId, fromLineNum } = pathOr({}, ['request', 'body'], ctx)
  const logFilePath = `${jobLogDir}/${moment(logDateTim, 'x').format('YYYY-MM-DD')}-${logId}.log`
  let logContent = undefined
  let toLineNum = undefined
  try {
    logContent = fs.readFileSync(logFilePath, { encoding: 'utf-8' })
    toLineNum = !!logContent ? logContent.split('\n').length : 0
  } catch (error) {
    log.err('readLog error:', error)
  }
  ctx.body = { code: 200, content: { fromLineNum, toLineNum, logContent, isEnd: true } }
}

const router = new Router()
// detect whether the executor is online
router.post('/beat', beat)
// check whether is already have the same job is running
router.post('/idleBeat', idleBeat)
// trigger job
router.post('/run', runJob)
// kill job
router.post('/kill', killJob)
// view job's execution log
router.post('/log', readLog)

export default router
