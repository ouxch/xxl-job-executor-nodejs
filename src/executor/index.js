/*import area*/
const KoaRouter = require('@koa/router')
const { Router: ExpressRouter } = require('express')
const logger = require('../utils/logger')
const log = logger('xxl-job-executor')
const { path, pathOr, pick, propOr } = require('../utils/purefuncs')
const { ifRunning, runJob, readJobLog, initJobs } = require('../job-manager')
const { initScheduleCenter } = require('../schedule-center')

/*function area*/
const beat = () => {
  return { code: 200, msg: 'online' }
}
const idleBeat = (jobId) => {
  return ifRunning(jobId) ? { code: 500, msg: 'busy' } : { code: 200, msg: 'idle' }
}
const killJob = () => {
  return { code: 200, msg: 'not yet support' }
}
const run = (jobCtx) => {
  try {
    runJob(jobCtx)
    return { code: 200, msg: 'success' }
  } catch (err) {
    return { code: 500, msg: propOr(err.toString(), 'message', err) }
  }
}
const readLog = (logDateTime, logId, fromLineNum) => {
  try {
    const { toLineNum, logContent, isEnd } = readJobLog(logDateTime, logId, fromLineNum)
    return { code: 200, content: { fromLineNum, toLineNum, logContent, isEnd } }
  } catch (err) {
    log.err('readLog error:', err)
    return { code: 500, msg: propOr(err.toString(), 'message', err) }
  }
}
const koaRestRouter = (uri, accessToken) => {
  const router = new KoaRouter({ prefix: uri })
  // access log
  router.use((ctx, next) => {
    ctx.status = 200
    const { url, method } = propOr({}, 'request', ctx)
    const begin = Date.now()
    next()
    const timeStr = `${Date.now() - begin}ms`
    log.info(method, url, ctx.status, timeStr)
  })
  // authentication
  router.use((ctx, next) => {
    const token = path(['request', 'headers', 'xxl-job-access-token'], ctx)
    if (!!accessToken && accessToken !== token) {
      ctx.body = { code: 500, msg: 'The access token is wrong.' }
      return
    }
    if (!pathOr(false, ['request', 'body'], ctx)) {
      throw 'please apply body-parser middleware first'
    }
    next()
  })

  const executorRouter = new KoaRouter()
  // detect whether the executor is online
  executorRouter.post('/beat', (ctx) => {
    ctx.body = beat()
  })
  // check whether is already have the same job is running
  executorRouter.post('/idleBeat', (ctx) => {
    const jobId = pathOr(-1, ['request', 'body', 'jobId'], ctx)
    ctx.body = idleBeat(jobId)
  })
  // trigger job
  executorRouter.post('/run', (ctx) => {
    const jobCtx = pick(['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'], pathOr({}, ['request', 'body'], ctx))
    ctx.body = run(jobCtx)
  })
  // kill job
  executorRouter.post('/kill', (ctx) => {
    ctx.body = killJob()
  })
  // view job's execution log
  executorRouter.post('/log', (ctx) => {
    const { logDateTim: logDateTime, logId, fromLineNum } = pathOr({}, ['request', 'body'], ctx)
    ctx.body = readLog(logDateTime, logId, fromLineNum)
  })

  router.use(executorRouter.routes(), executorRouter.allowedMethods())
  return router
}
const expressRestRouter = (accessToken) => {
  const router = new ExpressRouter()
  // access log
  router.use((req, res, next) => {
    res.status(200)
    const { url, method } = req
    const begin = Date.now()
    next()
    const timeStr = `${Date.now() - begin}ms`
    log.info(method, url, res.statusCode, timeStr)
  })
  // authentication
  router.use((req, res, next) => {
    const token = path(['headers', 'xxl-job-access-token'], req)
    if (!!accessToken && accessToken !== token) {
      res.send({ code: 500, msg: 'The access token is wrong.' })
      return
    }
    if (!propOr(false, 'body', req)) {
      throw 'please apply body-parser middleware first'
    }
    next()
  })
  // detect whether the executor is online
  router.post('/beat', (req, res) => {
    res.send(beat())
  })
  // check whether is already have the same job is running
  router.post('/idleBeat', (req, res) => {
    const jobId = pathOr(-1, ['body', 'jobId'], req)
    res.send(idleBeat(jobId))
  })
  // trigger job
  router.post('/run', (req, res) => {
    const jobCtx = pick(['jobId', 'executorHandler', 'executorParams', 'executorTimeout', 'logId', 'logDateTime'], propOr({}, 'body', req))
    res.send(run(jobCtx))
  })
  // kill job
  router.post('/kill', (req, res) => {
    res.send(killJob())
  })
  // view job's execution log
  router.post('/log', (req, res) => {
    const { logDateTim: logDateTime, logId, fromLineNum } = propOr({}, 'body', req)
    res.send(readLog(logDateTime, logId, fromLineNum))
  })
  return router
}
const initExecutor = (scheduleCenterUrl, executorKey, executorUrl, accessToken, jobLogPath, jobHandlers) => {
  initJobs(jobLogPath, jobHandlers)
  initScheduleCenter(scheduleCenterUrl, executorKey, executorUrl, accessToken)
}

/*export area*/
module.exports = { initExecutor, koaRestRouter, expressRestRouter }
