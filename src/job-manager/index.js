/*import area*/
const EventEmitter = require('events')
const moment = require('moment')
const fs = require('fs')
const { mkdir, omitNil, prop } = require('../utils/purefuncs')
const logger = require('../utils/logger')
const { callback } = require('../schedule-center')

/*variable area*/
const log = logger('xxl-job-manager')
const RUNNING_JOBS = new Set()
let JOB_HANDLERS
let JOB_LOG_PATH

/*function area*/
const initJobs = (jobLogPath, jobHandlers) => {
  mkdir(jobLogPath)
  JOB_LOG_PATH = jobLogPath
  JOB_HANDLERS = jobHandlers
}
const getLogFilePath = (dateTime, logId) => {
  return `${JOB_LOG_PATH}/${moment(dateTime, 'x').format('YYYY-MM-DD')}-${logId}.log`
}
const ifRunning = (jobId) => {
  return RUNNING_JOBS.has(jobId)
}
const removeFinishedJob = (jobId) => {
  RUNNING_JOBS.delete(jobId)
}
const runJob = ({ jobId, executorHandler, executorParams, executorTimeout, logId, logDateTime }) => {
  // check jobhandler and running job
  const jobHandler = JOB_HANDLERS.get(executorHandler)
  if (!jobHandler) throw `no matched jobHandler(${executorHandler})`
  if (RUNNING_JOBS.has(jobId)) throw `There is already have a same job is running, jobId:${jobId}`
  RUNNING_JOBS.add(jobId)
  // setup timeout
  let timeout = undefined
  if (!!executorTimeout) {
    timeout = setTimeout(() => jobEmitter.emit(JobEvent.FAIL, { jobId, logId, handleMsg: 'timeout' }))
  }
  // build logger for this job
  const logNameSpace = `${moment(logDateTime, 'x').format('YYYY-MM-DD')}-${logId}`
  const logFilePath = getLogFilePath(logDateTime, logId)
  const jobLogger = logger(logNameSpace, logFilePath)
  // execute job
  jobHandler({ jobLogger, ...omitNil(executorParams) })
    .then(() => jobEmitter.emit(JobEvent.SUCCESS, { jobId, logId }))
    .catch((err) => jobEmitter.emit(JobEvent.FAIL, { jobId, logId, handleMsg: prop('message', err) }))
    .then(() => !!timeout && clearTimeout(timeout))
}
const readJobLog = (logDateTime, logId, fromLineNum) => {
  const logFilePath = getLogFilePath(logDateTime, logId)
  const logContent = fs.readFileSync(logFilePath, { encoding: 'utf-8' })
  const toLineNum = !!logContent ? logContent.split('\n').length : 0
  return { fromLineNum, toLineNum, logContent, isEnd: true }
}

/*event area*/
class JobEmitter extends EventEmitter {}
const JobEvent = { SUCCESS: 'SUCCESS', FAIL: 'FAIL' }
const jobEmitter = new JobEmitter()
jobEmitter.on('error', (err) => log.err('jobEmitter on error:', err))
jobEmitter.on(JobEvent.SUCCESS, async ({ jobId, logId }) => {
  await callback({ logId })
  removeFinishedJob(jobId)
})
jobEmitter.on(JobEvent.FAIL, async ({ jobId, logId, handleMsg }) => {
  await callback({ logId, handleCode: 500, handleMsg })
  removeFinishedJob(jobId)
})

/*export area*/
module.exports = { initJobs, ifRunning, runJob, readJobLog }
