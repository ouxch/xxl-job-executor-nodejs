# A Node.js simple implementation of xxl job executor

### 添加组件依赖

```shell
git clone https://github.com/Aouchinx/xxl-job-executor-nodejs.git your_path
```

`package.json`

```json
{
  "dependencies": {
    "xxl-job-executor-nodejs": "your_path/xxl-job-executor-nodejs"
  }
}
```

### 使用组件

```javascript
const { applyXxlJobMiddleware } = require('xxl-job-executor-nodejs')
applyXxlJobMiddleware(app, appType, executorUri, executorUrl, executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers)
```

具体用法参考 `examples/express.js`、`examples/koa.js`

### 注意事项

任务必须被定义成 `promise` 函数，且第一个参数`jobLogger`是由组件定义的，负责输出任务的执行日志。如：

```javascript
const demoJobHandler = async (jobLogger, { jobParam1, jobParam2 }) => {
  jobLogger.info(`job start, jobParam1:${jobParam1}, jobParam2:${jobParam2}, it will takes about 10 seconds`)
  const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
  for (let i = 1; i <= 10; i++) {
    await sleep(1000)
    jobLogger.debug(`${i}s passed`)
  }
  jobLogger.info('job finish')
}
```

### 测试截图

![](./examples/screenshot/preview.png)
