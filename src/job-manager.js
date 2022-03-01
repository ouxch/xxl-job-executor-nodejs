const fs = require('fs')
const moment = require('moment')
const Path = require('path')
const logger = require('./logger')
const { Task, tapTask } = require('./purefuncs')
const { mkdir, searchInFile } = require('./file')

const log = logger('xxl-job-manager')

/**
 * 任务管理
 */
class JobManager {
  /**
   * @param {string} jobLogPath
   * @param {*} context
   */
  constructor(jobLogPath, context) {
    mkdir(jobLogPath)
    this.jobLogPath = jobLogPath
    this.context = context
    this.runningJobs = new Set()
  }

  /**
   * 根据调度时间获取日志文件路径
   * @param {number} dateTime
   * @return {string}
   */
  getLogFilePath(dateTime) {
    return Path.resolve(process.cwd(), `${this.jobLogPath}/${moment(dateTime, 'x').format('YYYY-MM-DD')}.log`)
  }

  /**
   * 构造任务logger的namespace
   * @param {string} handlerName
   * @param {number} dateTime
   * @param {number} logId
   * @return {string}
   */
  getJobLoggerNamespace(handlerName, dateTime, logId) {
    return `${handlerName}-${moment(dateTime, 'x').format('YYMMDD')}-${logId}-executing`
  }

  /**
   * @param {{number}} jobId
   * @return {boolean}
   */
  hasJob(jobId) {
    return this.runningJobs.has(jobId)
  }

  /**
   * @param {number} jobId
   * @param {string} jobJsonParams
   * @param {number} logId
   * @param {number} logDateTime
   * @param {number} executorTimeout
   * @param {string} handlerName
   * @param {function} jobHandler
   * @param {function} callback
   */
  runJob(jobId, jobJsonParams, logId, logDateTime, executorTimeout, handlerName, jobHandler, callback) {
    let timeout = undefined
    const logNameSpace = this.getJobLoggerNamespace(handlerName, logDateTime, logId)
    const logFilePath = this.getLogFilePath(logDateTime)
    const jobLogger = logger(logNameSpace, logFilePath)

    Task.of(jobJsonParams)
      .chain((jobJsonParams) => Task.of(jobJsonParams ? JSON.parse(jobJsonParams) : {}))
      .chain((jobParams) => {
        jobLogger.trace('start')
        // check duplicate job
        if (this.hasJob(jobId)) return Task.rejected('There is already have a same job is running')
        this.runningJobs.add(jobId)
        // setup timeout
        if (executorTimeout) {
          timeout = setTimeout(
            async () => await this.finishJob({ jobId, logId, jobLogger, callback, timeout, error: new Error('timeout') }),
            executorTimeout * 1000)
        }
        return Task.fromPromised(jobHandler)(jobLogger, jobParams, this.context)
      })
      .chain((result) => Task.of({ result }))
      .orElse((error) => Task.of({ error }))
      .chain(tapTask(async ({ result, error }) => await this.finishJob({ jobId, logId, jobLogger, callback, timeout, result, error })))
      .run().promise()
  }

  /**
   * @param {number} logDateTime
   * @param {number} logId
   * @return {Promise<Array>}
   */
  async readJobLog(logDateTime, logId) {
    const logFilePath = this.getLogFilePath(logDateTime)
    const jobLogNamespace = this.getJobLoggerNamespace('', logDateTime, logId) + ' '
    return fs.existsSync(logFilePath) ? await searchInFile(logFilePath, jobLogNamespace, `${jobLogNamespace} end`) : []
  }

  /**
   * @param {number} jobId
   * @param {number} logId
   * @param {*} jobLogger
   * @param {function} callback
   * @param {number} timeout
   * @param {*} result
   * @param {*} error
   * @return {Promise<void>}
   */
  async finishJob({ jobId, logId, jobLogger, callback, timeout, result, error }) {
    try {
      timeout && clearTimeout(timeout)
      result && jobLogger.trace('result: %o', result)
      error && jobLogger.err('error: %o', error.message || error)
      jobLogger.trace('end')
      jobLogger.close()
      await callback(error, { logId, result })
    } catch (err) {
      log.err('finishJob error: %o', err.message || err)
    }
    this.runningJobs.delete(jobId)
  }
}

module.exports = JobManager
