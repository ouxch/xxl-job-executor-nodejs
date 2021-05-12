const EventEmitter = require('events')
const fs = require('fs')
const moment = require('moment')
const KoaRouter = require('@koa/router')
const { Router: ExpressRouter } = require('express')
const { mkdir, prop, path, pathOr, pick, compose, format, omitNil, propOr, postTask, Task, tapTask } =
  require('./utils/purefuncs')
const formatData = compose(format, propOr({}, 'data'))
const xxlPostTask = ({ url, data, config }) => postTask(url, data, config)
const logger = require('./utils/logger')
const log = logger('xxl-job-executor')

class JobEmitter extends EventEmitter {
}

const JobEvent = { SUCCESS: 'SUCCESS', FAIL: 'FAIL' }

class Executor {
  constructor(appType, executorUri, executorUrl, executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers) {
    this.appType = appType
    this.executorUri = executorUri
    this.executorUrl = executorUrl
    this.executorKey = executorKey
    this.scheduleCenterUrl = scheduleCenterUrl
    this.accessToken = accessToken
    this.jobLogPath = jobLogPath
    this.jobHandlers = jobHandlers
    this.runningJobs = new Set()

    // create router
    switch (appType) {
      case 'EXPRESS':
        this.router = new ExpressRouter()
        this.initExpressRouter()
        break
      case 'KOA':
        this.router = new KoaRouter()
        this.initKoaRouter()
        break
      default:
        throw 'unsupported appType, only express or koa'
    }
    this.addRoutes()

    // init jobs and event
    mkdir(jobLogPath)
    const jobEmitter = new JobEmitter()
    this.jobEmitter = jobEmitter
    jobEmitter.on('error', (err) => log.err('jobEmitter on error:', err))
    jobEmitter.on(JobEvent.SUCCESS, async ({ jobId, logId }) => {
      await this.callback({ logId })
      this.runningJobs.delete(jobId)
    })
    jobEmitter.on(JobEvent.FAIL, async ({ jobId, logId, handleMsg }) => {
      await this.callback({ logId, handleCode: 500, handleMsg })
      this.runningJobs.delete(jobId)
    })
  }

  /**
   * 初始化适用于express的router
   */
  initExpressRouter() {
    // access log
    this.router.use(this.executorUri, (req, res, next) => {
      res.status(200)
      const { url, method } = req
      const begin = Date.now()
      next()
      log.info(method, url, res.statusCode, `${Date.now() - begin}ms`)
    })
    // authentication
    this.router.use(this.executorUri, (req, res, next) => {
      const token = path(['headers', 'xxl-job-access-token'], req)
      if (!!this.accessToken && this.accessToken !== token) {
        res.send({ code: 500, msg: 'The access token is wrong.' })
        return
      }
      if (!propOr(false, 'body', req)) throw 'please apply body-parser middleware first'
      next()
    })
  }

  /**
   * 初始化适用于koa的router
   */
  initKoaRouter() {
    // access log
    this.router.use(this.executorUri, (ctx, next) => {
      ctx.status = 200
      const { url, method } = propOr({}, 'request', ctx)
      const begin = Date.now()
      next()
      log.info(method, url, ctx.status, `${Date.now() - begin}ms`)
    })
    // authentication
    this.router.use(this.executorUri, (ctx, next) => {
      const token = path(['request', 'headers', 'xxl-job-access-token'], ctx)
      if (!!this.accessToken && this.accessToken !== token) {
        ctx.body = { code: 500, msg: 'The access token is wrong.' }
        return
      }
      if (!pathOr(false, ['request', 'body'], ctx)) throw 'please apply koa-bodyparser middleware first'
      next()
    })
  }

  wrappedHandler(contexts) {
    switch (this.appType) {
      case 'EXPRESS':
        const [req, res] = contexts
        return { req, res }
      case 'KOA':
        const [ctx] = contexts
        return { req: propOr({}, 'request', ctx), res: { send: (body) => ctx.body = body } }
    }
  }

  /**
   * 添加xxl-job相关的路由，供调度中心访问
   */
  addRoutes() {
    // detect whether the executor is online
    this.router.post(`${this.executorUri}/beat`, (...contexts) => {
      const { res } = this.wrappedHandler(contexts)
      res.send(this.beat())
    })
    // check whether is already have the same job is running
    this.router.post(`${this.executorUri}/idleBeat`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const jobId = pathOr(-1, ['body', 'jobId'], req)
      res.send(this.idleBeat(jobId))
    })
    // trigger job
    this.router.post(`${this.executorUri}/run`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const jobCtx = pick(['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'],
        propOr({}, 'body', req))
      res.send(this.run(jobCtx))
    })
    // kill job
    this.router.post(`${this.executorUri}/kill`, (...contexts) => {
      const { res } = this.wrappedHandler(contexts)
      res.send(this.killJob())
    })
    // view job's execution log
    this.router.post(`${this.executorUri}/log`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const { logDateTim: logDateTime, logId, fromLineNum } = propOr({}, 'body', req)
      res.send(this.readLog(logDateTime, logId, fromLineNum))
    })
  }

  apply(app) {
    switch (this.appType) {
      case 'EXPRESS':
        app.use(this.router)
        break
      case 'KOA':
        app.use(this.router.routes(), this.router.allowedMethods())
        break
      default:
        break
    }
  }

  /**
   * 心跳检测：调度中心检测执行器是否在线时使用
   */
  beat() {
    return { code: 200, msg: 'success' }
  }

  /**
   * 忙碌检测：调度中心检测指定执行器上指定任务是否忙碌（运行中）时使用
   * @param jobId - 任务ID
   */
  idleBeat(jobId) {
    return (this.runningJobs.has(jobId) ? { code: 500, msg: 'busy' } : { code: 200, msg: 'idle' })
  }

  /**
   * 触发任务执行
   * @param jobId - 任务ID
   * @param executorHandler - 任务标识
   * @param executorParams - 任务参数
   * @param executorTimeout - 任务超时时间，单位秒，大于零时生效
   * @param logId - 本次调度日志ID
   * @param logDateTime - 本次调度日志时间
   */
  run({ jobId, executorHandler, executorParams, executorTimeout, logId, logDateTime }) {
    try {
      // 检查任务标识是否有效
      const jobHandler = this.jobHandlers.get(executorHandler)
      if (!jobHandler) {
        return { code: 500, msg: `no matched jobHandler(${executorHandler})` }
      }
      // 是否有相同任务正在执行
      if (this.runningJobs.has(jobId)) {
        return { code: 500, msg: `There is already have a same job is running, jobId:${jobId}` }
      }

      this.runningJobs.add(jobId)

      // setup timeout
      let timeout = undefined
      if (!!executorTimeout) {
        timeout = setTimeout(() => this.jobEmitter.emit(JobEvent.FAIL, { jobId, logId, handleMsg: 'timeout' }),
          executorTimeout * 1000)
      }

      // build logger for this job
      const logNameSpace = `${moment(logDateTime, 'x').format('YYYY-MM-DD')}-${logId}`
      const logFilePath = this.getLogFilePath(logDateTime, logId)
      const jobLogger = logger(logNameSpace, logFilePath)

      // execute job
      jobHandler({ jobLogger, ...omitNil(executorParams) })
        .then(() => this.jobEmitter.emit(JobEvent.SUCCESS, { jobId, logId }))
        .catch((err) => this.jobEmitter.emit(JobEvent.FAIL, { jobId, logId, handleMsg: prop('message', err) }))
        .then(() => !!timeout && clearTimeout(timeout))
      return { code: 200, msg: 'success' }
    } catch (err) {
      return { code: 500, msg: propOr(err.toString(), 'message', err) }
    }
  }

  /**
   * 终止任务
   * @param jobId - 任务ID
   */
  killJob(jobId) {
    return { code: 500, msg: `not yet support, jobId${jobId}` }
  }

  /**
   * 查看执行日志
   * @param logDateTime - 本次调度日志时间
   * @param logId - 本次调度日志ID
   * @param fromLineNum - 日志开始行号
   * @return {*} - fromLineNum:日志开始行数; toLineNum:日志结束行号; logContent:日志内容; isEnd:日志是否全部加载完
   */
  readLog(logDateTime, logId, fromLineNum) {
    try {
      const logFilePath = this.getLogFilePath(logDateTime, logId)
      const logContent = fs.readFileSync(logFilePath, { encoding: 'utf-8' })
      const toLineNum = !!logContent ? logContent.split('\n').length : 0
      return { code: 200, content: { fromLineNum, toLineNum, logContent, isEnd: true } }
    } catch (err) {
      log.err('readLog error:', err)
      return { code: 500, msg: propOr(err.toString(), 'message', err) }
    }
  }

  /**
   * 通过logId获取日志文件路径
   * @param dateTime 调度日志时间
   * @param logId 调度日志ID
   */
  getLogFilePath(dateTime, logId) {
    return `${this.jobLogPath}/${moment(dateTime, 'x').format('YYYY-MM-DD')}-${logId}.log`
  }

  /**
   * 执行器注册：执行器注册时使用，调度中心会实时感知注册成功的执行器并发起任务调度
   */
  async registry() {
    const url = `${this.scheduleCenterUrl}/api/registry`
    const data = { 'registryGroup': 'EXECUTOR', 'registryKey': this.executorKey, 'registryValue': this.executorUrl }
    const headers = { 'xxl-job-access-token': this.accessToken }
    await Task.of({ url, data, config: { headers } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.info(`registry ==> ${format(data)} ==> ${formatData(response)}`)))
      .orElse((err) => {
        log.err(`registry error:${propOr(err.toString(), 'message', err)}`)
        return Task.of()
      })
      // register every 30 seconds. no register for more than 90 seconds, the schedule center will remove the executor.
      .chain(tapTask(() => setTimeout(this.registry.bind(this), 30000)))
      .run().promise()
  }

  /**
   * 执行器注册摘除：执行器注册摘除时使用，注册摘除后的执行器不参与任务调度与执行
   */
  async registryRemove() {
    const url = `${this.scheduleCenterUrl}/api/registryRemove`
    const data = { 'registryGroup': 'EXECUTOR', 'registryKey': this.executorKey, 'registryValue': this.executorUrl }
    const headers = { 'xxl-job-access-token': this.accessToken }
    await Task.of({ url, data, config: { headers } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.info(`registry remove ==> ${format(data)} ==> ${formatData(response)}`)))
      .orElse((err) => {
        log.err(`registry remove error:${propOr(err.toString(), 'message', err)}`)
        return Task.of()
      }).run().promise()
  }

  /**
   * 任务回调：执行器执行完任务后，回调任务结果时使用
   */
  async callback({ logId, handleCode = 200, handleMsg = 'success' }) {
    const url = `${this.scheduleCenterUrl}/api/callback`
    const headers = { 'xxl-job-access-token': this.accessToken }
    const data = [omitNil({ logId, logDateTim: Date.now(), handleCode, handleMsg })]
    await Task.of({ url, data, config: { headers } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.info(`callback ==> ${format(data[0])} ==> ${formatData(response)}`)))
      .orElse((err) => {
        log.err(`callback error:${propOr(err.toString(), 'message', err)}`)
        return Task.of({})
      }).run().promise()
  }

}

module.exports = Executor
