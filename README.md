# A Node.js simple implementation of xxl job executor

### add dependency

```shell
git submodule add https://github.com/Aouchinx/xxl-job-executor-nodejs.git modules/xxl-job-executor-nodejs
git submodule init
git submodule update --remote
```

```json
{
  "dependencies": {
    "xxl-job-executor-nodejs": "./modules/xxl-job-executor-nodejs"
  }
}
```

### usage

1. job handler

```javascript
/**
 * job handler demo
 * @param {any} logger
 * @param {Object} params
 * @param {Object} context
 * @return {Promise<any>}
 */
const demoJobHandler = async (logger, jobParams, context) => {
    logger.debug('params: %o, context: %o', params, context)
    const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
    for (let i = 1; i < 10; i++) {
      await sleep(1000)
      logger.debug(`${i}s passed`)
    }
  }
```

2. envionment variables

```dotenv
XXL_JOB_EXECUTOR_KEY=executor-example-express
XXL_JOB_SCHEDULE_CENTER_URL=http://127.0.0.1:8080/xxl-job-admin
XXL_JOB_ACCESS_TOKEN=9217CF7406F643BEB71CC00731129CC9
# 任务执行日志存储路径
XXL_JOB_JOB_LOG_PATH=logs/job
# 执行器运行日志开关(非任务执行日志)，未设置的话默认关闭
XXL_JOB_DEBUG_LOG=true
```

3. apply executor

```javascript
const XxlJobExecutor = require('xxl-job-executor-nodejs')
const jobHandlers = new Map([ [ 'demoJobHandler', demoJobHandler ] ])
const context = { /*anything*/ }
const xxlJobExecutor = new XxlJobExecutor(jobHandlers, context)
await xxlJobExecutor.applyMiddleware({ app, appType, appDomain, path })
```

具体用法参考 examples 提供的`express` 和 `koa` 的集成示例
