const os = require('os')
const Path = require('path')
const EventEmitter = require('events')
const moment = require('moment')
const {
  last,
  mkdir,
  path,
  pathOr,
  pick,
  grepVersion,
  grepFile,
  grepWithQFGets,
  omitNil,
  propOr,
  postTask,
  Task,
  tapTask,
  appendExecutePermission4Grep,
} = require('./utils/purefuncs')

const xxlPostTask = ({ url, data, config }) => postTask(url, data, config)
const logger = require('./utils/logger')
const log = logger('xxl-job-executor')

class JobEmitter extends EventEmitter {
}

const JobEvent = { SUCCESS: 'SUCCESS', FAIL: 'FAIL' }

class Executor {
  constructor(executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers) {
    this.executorKey = executorKey
    this.scheduleCenterUrl = scheduleCenterUrl
    this.accessToken = accessToken
    this.jobLogPath = jobLogPath
    this.jobHandlers = jobHandlers

    // init jobs and event
    this.runningJobs = new Set()
    mkdir(this.jobLogPath)
    const jobEmitter = new JobEmitter()
    this.jobEmitter = jobEmitter
    jobEmitter.on('error', (err) => log.err('jobEmitter on error:', err.message || JSON.stringify(err)))
    jobEmitter.on(JobEvent.SUCCESS, async ({ jobId, logId, jobLogger }) => {
      jobLogger.info('job end')
      jobLogger.closeLogger()
      await this.callback({ logId })
      this.runningJobs.delete(jobId)
    })
    jobEmitter.on(JobEvent.FAIL, async ({ jobId, logId, handleMsg, jobLogger }) => {
      jobLogger.info('job end')
      jobLogger.closeLogger()
      await this.callback({ logId, handleCode: 500, handleMsg })
      this.runningJobs.delete(jobId)
    })

    // init grep script permission
    this.grepSupported = !!grepVersion()
    if (this.grepSupported) appendExecutePermission4Grep()
  }

  async applyMiddleware({ app, appType, appDomain, uri }) {
    switch (appType) {
      case 'EXPRESS': {
        const Express = require('express')
        const Router = Express.Router
        this.router = new Router()
        this.initExpressRouter(uri)
        app.use(this.router)
        break
      }
      case 'KOA': {
        const KoaRouter = require('@koa/router')
        this.router = new KoaRouter()
        this.initKoaRouter(uri)
        app.use(this.router.routes(), this.router.allowedMethods())
        break
      }
      default:
        throw 'unsupported appType, just support express or koa'
    }
    this.appType = appType
    this.executorUrl = appDomain + uri
    await this.registry()
  }

  /**
   * 初始化适用于express的router
   */
  initExpressRouter(uri) {
    // access log
    this.router.use(uri, async (req, res, next) => {
      res.status(200)
      const { url, method, body } = req
      const begin = Date.now()
      await next()
      log.info('%s %s %d %s %o', method, url, res.statusCode, `${Date.now() - begin}ms`, body)
    })
    // authentication
    this.router.use(uri, async (req, res, next) => {
      const token = path([ 'headers', 'xxl-job-access-token' ], req)
      if (!!this.accessToken && this.accessToken !== token) {
        res.send({ code: 500, msg: 'the access token is wrong.' })
        return
      }
      if (!propOr(false, 'body', req)) {
        res.send({ code: 500, msg: 'need apply body-parser middleware first.' })
        return
      }
      await next()
    })
    this.addRoutes(uri)
  }

  /**
   * 初始化适用于koa的router
   */
  initKoaRouter(uri) {
    // access log
    this.router.use(uri, async (ctx, next) => {
      ctx.status = 200
      const { url, method, body } = propOr({}, 'request', ctx)
      const begin = Date.now()
      await next()
      log.info('%s %s %d %s %o', method, url, ctx.status, `${Date.now() - begin}ms`, body)
    })
    // authentication
    this.router.use(uri, async (ctx, next) => {
      const token = path([ 'request', 'headers', 'xxl-job-access-token' ], ctx)
      if (!!this.accessToken && this.accessToken !== token) {
        ctx.body = { code: 500, msg: 'The access token is wrong.' }
        return
      }
      if (!pathOr(false, [ 'request', 'body' ], ctx)) {
        ctx.body = { code: 500, msg: 'Please apply koa-bodyparser middleware first.' }
        return
      }
      await next()
    })
    this.addRoutes(uri)
  }

  /**
   * 添加xxl-job相关的路由，供调度中心访问
   */
  addRoutes(baseUri) {
    // detect whether the executor is online
    this.router.post(`${baseUri}/beat`, (...contexts) => {
      const { res } = this.wrappedHandler(contexts)
      res.send(this.beat())
    })
    // check whether is already have the same job is running
    this.router.post(`${baseUri}/idleBeat`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const jobId = pathOr(-1, [ 'body', 'jobId' ], req)
      res.send(this.idleBeat(jobId))
    })
    // trigger job
    this.router.post(`${baseUri}/run`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const jobCtx = pick([ 'jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime' ],
        propOr({}, 'body', req))
      res.send(this.run(jobCtx))
    })
    // kill job
    this.router.post(`${baseUri}/kill`, (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      res.send(this.killJob(pathOr(-1, [ 'body', 'jobId' ], req)))
    })
    // view job's execution log
    this.router.post(`${baseUri}/log`, async (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const { logDateTim: logDateTime, logId, fromLineNum } = propOr({}, 'body', req)
      const data = await this.readLog(logDateTime, logId, fromLineNum)
      res.send(data)
    })
  }

  /**
   * 将koa和express的request body处理成相同的结构，方便后边router处理
   * @param {any} contexts
   * @return {Object}
   */
  wrappedHandler(contexts) {
    switch (this.appType) {
      case 'EXPRESS':
        const [ req, res ] = contexts
        return { req, res }
      case 'KOA':
        const [ ctx ] = contexts
        return { req: propOr({}, 'request', ctx), res: { send: (body) => ctx.body = body } }
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
   * @param handlerName - 任务的handler名字
   * @param jobJsonParams - 任务参数
   * @param executorTimeout - 任务超时时间，单位秒，大于零时生效
   * @param logId - 本次调度日志ID
   * @param logDateTime - 本次调度日志时间
   */
  run({ jobId, executorHandler: handlerName, executorParams: jobJsonParams, executorTimeout, logId, logDateTime }) {
    // check executorHandler
    const jobHandler = this.jobHandlers.get(handlerName)
    if (!jobHandler) {
      return { code: 500, msg: `no matched jobHandler(${handlerName})` }
    }
    // check duplicate job
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
    const logNameSpace = this.getJobLoggerNamespace(handlerName, logDateTime, logId)
    const logFilePath = this.getLogFilePath(logDateTime)
    const jobLogger = logger(logNameSpace, logFilePath)

    // execute job
    Task.of(jobJsonParams)
      .chain((jobJsonParams) => Task.of(!!jobJsonParams ? JSON.parse(jobJsonParams) : {}))
      .chain((jobParams) => {
        jobLogger.info('job start')
        return Task.fromPromised(jobHandler)(jobLogger, jobParams)
      })
      .orElse((error) => {
        jobLogger.err('execute job error', error)
        this.jobEmitter.emit(JobEvent.FAIL, { jobId, logId, handleMsg: error.toString(), jobLogger })
        return Task.of()
      })
      .chain(tapTask(() => {
        if (!!timeout) clearTimeout(timeout)
        this.jobEmitter.emit(JobEvent.SUCCESS, { jobId, logId, jobLogger })
      }))
      .run().promise()
    return { code: 200, msg: 'success' }
  }

  /**
   * 终止任务
   * @param jobId - 任务ID
   */
  killJob(jobId) {
    return { code: 500, msg: `not yet support, jobId(${jobId})` }
  }

  /**
   * 查看执行日志
   * @param logDateTime - 本次调度日志时间
   * @param logId - 本次调度日志ID
   * @param fromLineNum - 日志开始行号
   * @return {*} - fromLineNum:日志开始行号; toLineNum:日志结束行号; logContent:日志内容
   */
  async readLog(logDateTime, logId, fromLineNum) {
    let logContent
    let toLineNum
    try {
      const logFilePath = this.getLogFilePath(logDateTime)
      const jobLogNamespace = this.getJobLoggerNamespace('', logDateTime, logId) + ' '
      const grepResult = this.grepSupported
        ? await grepFile(logFilePath, jobLogNamespace)
        : await grepWithQFGets(logFilePath, jobLogNamespace, `${jobLogNamespace}job end`)
      const lines = (grepResult || '').split(os.EOL).slice(fromLineNum - 1)
      if (last(lines) === '') lines.pop()
      toLineNum = fromLineNum + lines.length - 1
      lines.unshift('')
      logContent = lines.join('\n')
    } catch (err) {
      log.err('readLog exception', err.message || JSON.stringify(err))
      toLineNum = fromLineNum
      logContent = err.toString()
    }
    return { code: 200, content: { fromLineNum, toLineNum, logContent } }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(dateTime) {
    return Path.resolve(process.cwd(), `${this.jobLogPath}/${moment(dateTime, 'x').format('YYYY-MM-DD')}.log`)
  }

  /**
   * 获取日志namespace
   */
  getJobLoggerNamespace(handlerName, dateTime, logId) {
    return `${handlerName}-${moment(dateTime, 'x').format('YYMMDD')}-${logId}-executing`
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
      .chain(tapTask((response) => log.info('registry ==> %o ==> %o', data, omitNil(propOr({}, 'data', response)))))
      .orElse((err) => {
        log.err('registry error', err.message || JSON.stringify(err))
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
      .chain(tapTask((response) => log.info('registry remove ==> %o ==> %o', data, omitNil(propOr({}, 'data', response)))))
      .orElse((err) => {
        log.err('registry remove error', err.message || JSON.stringify(err))
        return Task.of()
      }).run().promise()
  }

  /**
   * 任务回调：执行器执行完任务后，回调任务结果时使用
   */
  async callback({ logId, handleCode = 200, handleMsg = 'success' }) {
    const url = `${this.scheduleCenterUrl}/api/callback`
    const headers = { 'xxl-job-access-token': this.accessToken }
    const data = [ omitNil({ logId, logDateTim: Date.now(), handleCode, handleMsg }) ]
    await Task.of({ url, data, config: { headers } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.info('callback ==> %o ==> %o', data[0], omitNil(propOr({}, 'data', response)))))
      .orElse((err) => {
        log.err('callback error', err.message || JSON.stringify(err))
        return Task.of({})
      }).run().promise()
  }

}

module.exports = Executor
