# A Node.js implementation of xxl job executor

### 添加组件依赖

```shell
git clone https://github.com/Aouchinx/xxl-job-executor-nodejs.git your_path/xxl-job-executor-nodejs
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

`env`

```yaml
# 执行器AppName，在调度中心配置执行器时使用
XXL_JOB_EXECUTOR_KEY: 'executor-example-express',
# 调度中心地址, eg: 'http://127.0.0.1:8080/xxl-job-admin'
XXL_JOB_SCHEDULE_CENTER_URL: 'http://127.0.0.1:8080/xxl-job-admin',
# 请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
XXL_JOB_ACCESS_TOKEN: '9217CF7406F643BEB71CC00731129CC9',
# 任务执行日志的存储路径， eg: 'logs/job'
XXL_JOB_JOB_LOG_PATH: 'logs/job',
# 执行器运行日志开关(非任务执行的日志) eg: '1' or '0'
XXL_JOB_DEBUG_LOG: '1',
```

`javascript`

```javascript
const XxlJobExecutor = require('xxl-job-executor-nodejs')
const xxlJobExecutor = new XxlJobExecutor(jobHandlers)
await xxlJobExecutor.applyMiddleware({ app, appType, appDomain, path })
```

具体用法参考 `examples/express.js`、`examples/koa.js`

### 注意事项

1. 任务需定义成 `promise` 函数
2. 第一个参数`jobLogger`由组件初始化，日志通过`jobLogger`记录后，可在调度中心查看详情
3. 后面的参数的是任务执行参数(可选)，在调度中心配置定时任务或手动触发任务时，都可设置执行参数

```javascript
const demoJobHandler = async (jobLogger, { jobParam1, jobParam2 }) => {
  jobLogger.info(`jobParam1:${jobParam1}, jobParam2:${jobParam2}, it will takes about 10 seconds`)
  const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
  for (let i = 1; i <= 10; i++) {
    await sleep(1000)
    jobLogger.debug(`${i}s passed`)
  }
}
```

### 测试截图

![](./examples/screenshot/preview.png)
