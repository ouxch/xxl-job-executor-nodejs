import bodyparser from 'koa-bodyparser'
import config from '@src/config'
import executorRouter from '@src/executor'
import gracefullyShutdown from '@src/utils/gracefulShutdown'
import Koa from 'koa'
import logger from '@src/utils/logger'
import logging from '@src/utils/logging'
import { format, path, propOr } from '@src/utils/purefuncs'
import { registryRemoveTask, registryTask } from '@src/schedule-center'

logging()
const log = logger('app')
const { accessToken, appName, hostname, port, executorUrl } = config
const app = new Koa()
app.use(bodyparser())

// access-log
app.use(async (ctx, next) => {
  ctx.status = 200
  const { url, method, body } = propOr({}, 'request', ctx)
  const requestBodyStr = Object.keys(body).length > 0 ? format(body) : '-'
  const begin = Date.now()
  await next()
  const timeStr = `${Date.now() - begin}ms`
  const responseBody = propOr(undefined, 'body', ctx)
  const responseBodyStr = !!responseBody ? format(responseBody) : '-'
  log.info(method, url, ctx.status, timeStr, requestBodyStr, responseBodyStr)
})
// authentication
app.use(async (ctx, next) => {
  const token = path(['request', 'headers', 'xxl-job-access-token'], ctx)
  !!accessToken && accessToken !== token
    ? ctx.body = { code: 500, msg: 'The access token is wrong.' }
    : await next()
})
// executor api
app.use(executorRouter.routes()).use(executorRouter.allowedMethods())

// entry
Promise.resolve()
  .then(async () => await registryTask.run().promise)
  .then(() => gracefullyShutdown(registryRemoveTask))
  .then(() => app.listen(port, hostname, () => log.info(`${appName} listening at ${executorUrl}`)))
  .catch((err) => log.err('init server error:', err))
