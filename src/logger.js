const debug = require('debug')
const fs = require('fs')
const os = require('os')
const util = require('util')
const { always, propOr } = require('./purefuncs')

const enableExecutorDebugLog = /^(yes|on|true|enable|enabled|1)$/i.test(`${propOr(false, 'XXL_JOB_DEBUG_LOG', process.env)}`)
const enableLogLevels = propOr('info:*,warn:*,error:*,debug:*,trace:*', 'DEBUG', process.env)

const writeStreamOptions = { flags: 'a', encoding: 'utf8', autoClose: true, emitClose: true }

const noop = always(undefined)
const noopLogger = { info: noop, err: noop, debug: noop, warn: noop, trace: noop }

const dErr = debug('error')
const dInfo = debug('info')
const dWarn = debug('warn')
const dDebug = debug('debug')
const dTrace = debug('trace')

// 自定义对象，包装 debug 模拟日志级别
const createLogger = (ns) => {
  const logger = {
    info: dInfo.extend(ns),
    err: dErr.extend(ns),
    debug: dDebug.extend(ns),
    warn: dWarn.extend(ns),
    trace: dTrace.extend(ns),
  }
  Object.values(logger).forEach((levelLogger) => Object.assign(levelLogger, { enabled: true, useColors: false }))
  return logger
}

module.exports = (ns, logFilePath) => {
  // 1. 执行器运行日志，输出到 stderr，限制日志级别
  if (!logFilePath) {
    if (!enableExecutorDebugLog) return noopLogger
    const logger = createLogger(ns)
    Object.entries(logger).forEach(([level, levelLogger]) => levelLogger.enabled = enableLogLevels.includes(level))
    return logger
  }

  // 2. 任务执行日志，同时输出到 stderr 和 文件，stderr 限制日志级别，输出到文件不限制级别以供调度中心全量查看
  const writeStream = fs.createWriteStream(logFilePath, writeStreamOptions)
  const log2File = (...args) => writeStream.write(`${util.format(...args)}${os.EOL}`)
  const log2Stderr = (...args) => console.error(util.format(...args))
  const log2FileAndStderr = (...args) => {
    const content = util.format(...args)
    writeStream.write(`${content}${os.EOL}`)
    console.error(content)
  }
  const logger = createLogger(ns)

  // 设置输出
  Object.entries(logger).forEach(([level, levelLogger]) => {
    levelLogger.log = enableLogLevels.includes(level) ? log2FileAndStderr : log2File
  })

  // 任务执行完成，关闭文件输出流，后续日志只输出到 stderr
  logger.close = () => {
    Object.entries(logger).forEach(([level, levelLogger]) => {
      Object.assign(levelLogger, { enabled: enableLogLevels.includes(level), log: log2Stderr })
    })
    writeStream.end()
  }

  return logger
}
