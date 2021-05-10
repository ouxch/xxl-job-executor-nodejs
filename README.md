# A Node.js simple implementation of xxl job executor

## usage:

`add dependency, git commands:`

```shell
git submodule add https://github.com/Aouchinx/xxl-job-executor-nodejs.git modules/xxl-job-executor-nodejs
```

`package.json`(don't forget run yarn)

```json
{
  "dependencies": {
    "xxl-job-executor-nodejs": "./modules/xxl-job-executor-nodejs"
  }
}
```

`js code`
```javascript
// all jobs, note that a job must declared as a promise function, the job's execution log must be output by the jobLogger
const demoJobHandler = async ({ jobLogger, ...jobParams }) => {
  jobLogger.info('job start, it will takes about 10 seconds')
  const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
  await sleep(10000)
  jobLogger.info('job finish')
}
const jobHandlers = new Map([['demoJobHandler', demoJobHandler]])

// koa app
const Koa = require('koa')
const bodyparser = require('koa-bodyparser')
const app = new Koa()
app.use(bodyparser())

// or express app
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())

// executor config
const executorConfig = {
  uri: '/job',
  app,
  appType: 'koa', // or 'express'
  scheduleCenterUrl: 'http://127.0.0.1:8080/xxl-job-admin',
  executorKey: 'xxl-job-executor-nodejs',
  executorUrl: 'http://127.0.0.1:3000/job',
  accessToken: '9217CF7406F643BEB71CC00731129CC9',
  jobLogPath: 'logs/job',
  jobHandlers,
}

// apply middleware
const { applyExecutorMiddleware } = require('xxl-job-executor-nodejs')
applyExecutorMiddleware(executorConfig)

app.listen(3000, '127.0.0.1', () => console.log('server startup'))

```
