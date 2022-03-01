const { last, path, pathOr, pick, omitNil, propOr, postTask, Task, tapTask } = require('./purefuncs')
const JobManager = require('./job-manager')
const logger = require('./logger')
const log = logger('xxl-job-executor')
const xxlPostTask = ({ url, data, config }) => postTask(url, data, config)

/**
 * xxl-job 执行器 restful API
 * https://www.xuxueli.com/xxl-job/#6.2%20%E6%89%A7%E8%A1%8C%E5%99%A8%20RESTful%20API
 */
class Executor {
  /**
   * @param {string} executorKey
   * @param {string} scheduleCenterUrl
   * @param {string} accessToken
   * @param {string} jobLogPath
   * @param {Map} jobHandlers
   * @param {*} context
   */
  constructor(executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers, context) {
    this.executorKey = executorKey
    this.scheduleCenterUrl = scheduleCenterUrl
    this.accessToken = accessToken
    this.jobHandlers = jobHandlers
    this.jobManager = new JobManager(jobLogPath, context)
  }

  /**
   * 应用执行器中间件
   * @param {*} app
   * @param {string} appType
   * @param {string} appDomain
   * @param {string} uri
   */
  applyMiddleware({ app, appType, appDomain, uri }) {
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
  }

  /**
   * 初始化适用于express的router
   * @param {string} uri
   */
  initExpressRouter(uri) {
    // authentication
    this.router.use(uri, async (req, res, next) => {
      res.status(200)
      const { url, method, body } = req
      log.trace('%s %s %o', method, url, omitNil(pick(['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'], body)))
      const token = path(['headers', 'xxl-job-access-token'], req)
      if (!!this.accessToken && this.accessToken !== token) {
        res.send({ code: 500, msg: 'access token incorrect' })
        return
      }
      if (!propOr(false, 'body', req)) {
        res.send({ code: 500, msg: 'need apply body-parser middleware first' })
        return
      }
      await next()
    })
    this.addRoutes(uri)
  }

  /**
   * 初始化适用于koa的router
   * @param {string} uri
   */
  initKoaRouter(uri) {
    // authentication
    this.router.use(uri, async (ctx, next) => {
      ctx.status = 200
      const { url, method, body } = propOr({}, 'request', ctx)
      log.trace('%s %s %o', method, url, omitNil(pick(['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'], body)))
      const token = path(['request', 'headers', 'xxl-job-access-token'], ctx)
      if (!!this.accessToken && this.accessToken !== token) {
        ctx.body = { code: 500, msg: 'access token incorrect' }
        return
      }
      if (!pathOr(false, ['request', 'body'], ctx)) {
        ctx.body = { code: 500, msg: 'need apply koa-bodyparser middleware first' }
        return
      }
      await next()
    })
    this.addRoutes(uri)
  }

  /**
   * 添加xxl-job相关的路由，供调度中心访问
   * @param {string} baseUri
   */
  addRoutes(baseUri) {
    // detect whether the executor is online
    this.router.post(`${baseUri}/beat`, async (...contexts) => {
      const { res } = this.wrappedHandler(contexts)
      res.send(this.beat())
    })
    // check whether is already have the same job is running
    this.router.post(`${baseUri}/idleBeat`, async (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      const jobId = pathOr(-1, ['body', 'jobId'], req)
      res.send(this.idleBeat(jobId))
    })
    // trigger job
    this.router.post(`${baseUri}/run`, async (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      res.send(this.run(propOr({}, 'body', req)))
    })
    // kill job
    this.router.post(`${baseUri}/kill`, async (...contexts) => {
      const { req, res } = this.wrappedHandler(contexts)
      res.send(this.killJob(pathOr(-1, ['body', 'jobId'], req)))
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
      case 'EXPRESS': {
        const [req, res] = contexts
        return { req, res }
      }
      case 'KOA': {
        const [ctx] = contexts
        return { req: propOr({}, 'request', ctx), res: { send: (body) => ctx.body = body } }
      }
    }
  }

  /**
   * 心跳检测：调度中心检测执行器是否在线时使用
   * @return {{code: number, msg: string}}
   */
  beat() {
    return { code: 200, msg: 'success' }
  }

  /**
   * 忙碌检测：调度中心检测指定执行器上指定任务是否忙碌（运行中）时使用
   * @param {string} jobId - 任务ID
   * @return {{code: number, msg: string}}
   */
  idleBeat(jobId) {
    return (this.jobManager.hasJob(jobId) ? { code: 500, msg: 'busy' } : { code: 200, msg: 'idle' })
  }

  /**
   * 触发任务执行
   * @param {number} jobId - 任务ID
   * @param {string} handlerName - 任务的handler名字
   * @param {string} jobJsonParams - 任务参数
   * @param {number} executorTimeout - 任务超时时间，单位秒，大于零时生效
   * @param {number} logId - 本次调度日志ID
   * @param {number} - 本次调度日志时间
   * @return {{code: number, msg: string}}
   */
  run({ jobId, executorHandler: handlerName, executorParams: jobJsonParams, executorTimeout, logId, logDateTime }) {
    // check executorHandler
    const jobHandler = this.jobHandlers.get(handlerName)
    if (!jobHandler) {
      return { code: 500, msg: `no matched jobHandler(${handlerName})` }
    }
    // execute job
    this.jobManager.runJob(jobId, jobJsonParams, logId, logDateTime, executorTimeout, handlerName, jobHandler, this.callback.bind(this))

    return { code: 200, msg: 'success' }
  }

  /**
   * 终止任务
   * @param {number} jobId - 任务ID
   * @return {{code: number, msg: string}}
   */
  killJob(jobId) {
    return { code: 500, msg: `not yet support, jobId(${jobId})` }
  }

  /**
   * 查看执行日志
   * @param {number} logDateTime - 本次调度日志时间
   * @param {number} logId - 本次调度日志ID
   * @param {number} fromLineNum - 日志开始行号
   * @return {*} - fromLineNum:日志开始行号; toLineNum:日志结束行号; logContent:日志内容
   */
  async readLog(logDateTime, logId, fromLineNum) {
    let logContent
    let toLineNum
    try {
      const lines = await this.jobManager.readJobLog(logDateTime, logId)
      lines.splice(0, fromLineNum - 1)
      if (last(lines) === '') lines.pop()
      toLineNum = fromLineNum + lines.length - 1
      lines.unshift('')
      logContent = lines.join('\n')
    } catch (err) {
      log.err('readLog error: %o', err.message || err)
      toLineNum = fromLineNum
      logContent = err.toString()
    }
    return { code: 200, content: { fromLineNum, toLineNum, logContent } }
  }

  /**
   * 执行器注册：执行器注册时使用，调度中心会实时感知注册成功的执行器并发起任务调度
   */
  async registry() {
    const url = `${this.scheduleCenterUrl}/api/registry`
    const data = { 'registryGroup': 'EXECUTOR', 'registryKey': this.executorKey, 'registryValue': this.executorUrl }
    const headers = { 'xxl-job-access-token': this.accessToken }
    await xxlPostTask({ url, data, config: { headers } })
      .chain(tapTask((response) => log.trace('registry %o ==> %o', data, omitNil(propOr({}, 'data', response)))))
      .orElse((err) => {
        log.err('registry error: %o', err.message || err)
        return Task.of()
      })
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
      .chain(tapTask((response) => log.trace('registry remove %o ==> %o', data, omitNil(propOr({}, 'data', response)))))
      .orElse((err) => {
        log.err('registry remove error: %o', err.message || err)
        return Task.of()
      }).run().promise()
  }

  /**
   * 任务回调：执行器执行完任务后，回调任务结果时使用
   * @param {*} error
   * @param {{logId: number, result: any}} jobResult
   */
  async callback(error, { logId, result }) {
    const url = `${this.scheduleCenterUrl}/api/callback`
    const headers = { 'xxl-job-access-token': this.accessToken }

    const handleCode = error ? 500 : 200
    const handleMsg = error ? error.message || error.toString() : (result ? JSON.stringify(result) : 'success')
    const data = [{ logId, logDateTim: Date.now(), handleCode, handleMsg }]

    await Task.of({ url, data, config: { headers } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.trace('callback %o ==> %o', data[0], omitNil(propOr({}, 'data', response)))))
      .orElse(tapTask((err) => log.err('callback error: %o', err.message || err)))
      .run().promise()
  }
}

module.exports = Executor
