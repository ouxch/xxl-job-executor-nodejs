import config from '@src/config'
import EventEmitter from 'events'
import jobHandlers from '@src/job-handlers'
import logger from '@src/utils/logger'
import moment from 'moment'
import { callbackTask } from '@src/schedule-center'
import { omitNil, prop } from '@src/utils/purefuncs'

const { jobLogDir } = config
const log = logger('job-manager')

const runningJobs = new Set()

/**
 * job emitter
 */
class JobEmitter extends EventEmitter {}
const JobEmitterEvent = {
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
}
const jobEmitter = new JobEmitter()
jobEmitter.on('error', (err) => log.err('jobEmitter on error:', err))
jobEmitter.on(JobEmitterEvent.SUCCESS, async ({ jobId, logId }) => {
  await callbackTask({ logId }).run().promise()
  runningJobs.delete(jobId)
})
jobEmitter.on(JobEmitterEvent.FAIL, async ({ jobId, logId, handleMsg }) => {
  await callbackTask({ logId, handleCode: 500, handleMsg }).run().promise()
  runningJobs.delete(jobId)
})

const ifRunning = (jobId) => runningJobs.has(jobId)
const addJob = ({ jobId, executorHandler, executorParams, executorTimeout, logId, logDateTime }) => {
  // validate job parameter
  const jobHandler = jobHandlers.get(executorHandler)
  if (!jobHandler) throw `no matched jobHandler(${executorHandler})`
  if (ifRunning(jobId)) throw `There is already have a same job is running, jobId:${jobId}`
  runningJobs.add(jobId)

  // setup timeout
  let timeout = undefined
  if (!!executorTimeout) {
    timeout = setTimeout(() => jobEmitter.emit(JobEmitterEvent.FAIL, { jobId, logId, handleMsg: 'timeout' }))
  }

  // build logger for this job
  const logNameSpace = `${moment(logDateTime, 'x').format('YYYY-MM-DD')}-${logId}`
  const logFilePath = `${jobLogDir}/${logNameSpace}.log`
  const log = logger(logNameSpace, logFilePath)

  // execute job
  jobHandler({ log, ...omitNil(executorParams) })
    .then(() => jobEmitter.emit(JobEmitterEvent.SUCCESS, { jobId, logId }))
    .catch((err) => jobEmitter.emit(JobEmitterEvent.FAIL, { jobId, logId, handleMsg: prop('message', err) }))
    .then(() => !!timeout && clearTimeout(timeout))
}

export { ifRunning, addJob }
