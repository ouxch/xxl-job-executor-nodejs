const log = require('../src/logger')('shutdown')
const shutdownHandlers = []
let shutdownTimes = 0
const shutdownSignals = ['SIGINT', 'SIGHUP', 'SIGTERM']
shutdownSignals.forEach((event) => process.on(event, async () => {
  log.trace(`************ process event:${event} ************`)
  if (shutdownTimes > 0) return
  shutdownTimes += 1
  for (const handler of shutdownHandlers) {
    await handler().catch((err) => log.err('shutdown handler error: %o', err.message || err))
  }
  process.exit(0)
}))
// exit事件监听器函数只能执行同步操作，因为 Node.js 进程将在调用 'exit' 事件所有的监听器后立即退出，事件循环中还在排队的操作全部丢弃。
process.on('exit', () => log.trace('************ The process exits completely. ************'))

/**
 * add shutdown handler
 * @param {...Function<Promise>} handlers
 * @return {Number} number
 */
const addShutdownHandlers = (...handlers) => shutdownHandlers.push(...handlers)

module.exports = { addShutdownHandlers }
