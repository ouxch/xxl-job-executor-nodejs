import logger from '@src/utils/logger'

const log = logger('app')
const handlerTasks = new Set()

process.on('SIGINT', async () => {
  log.info('gracefully shutting down from SIGINT (Ctrl-C)')
  for (const task of handlerTasks) {
    await task.run().promise().catch((error) => log.err('gracefullyShutdown handler error:', error))
  }
  process.exit(1)
})

export default (handlerTask) => handlerTasks.add(handlerTask)
