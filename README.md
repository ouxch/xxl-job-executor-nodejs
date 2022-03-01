# A Node.js simple implementation of xxl job executor

---

### 添加组件

1.添加子模块

```shell
git submodule add https://github.com/Aouchinx/xxl-job-executor-nodejs.git modules/xxl-job-executor-nodejs
```

2.更新子模块

```shell
git submodule init
git submodule update --remote
```

3.添加组件依赖

```json
{
  "dependencies": {
    "xxl-job-executor-nodejs": "./modules/xxl-job-executor-nodejs"
  }
}
```

---

### 使用组件

1.定义任务执行函数

```javascript
/**
 * demo任务
 * @param {any} jobLogger 由xxl-job组件定义的任务logger，会将日志内容输出到文件，可在调度中心查看执行日志
 * @param {{ jobParam1: any, jobParam2: any }} jobParams 任务参数
 * @param {Object} context 任务上下文
 * @return {Promise<void>} 函数必须返回一个 promise
 */
const demoJobHandler = async (jobLogger, jobParams, context) => {
    jobLogger.debug('params: %o, context: %o', jobParams, context)
    const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
    for (let i = 1; i < 10; i++) {
      await sleep(1000)
      jobLogger.debug(`${i}s passed`)
    }
  }
```

2.配置环境变量

```dotenv
# 执行器AppName，在调度中心配置执行器时使用
XXL_JOB_EXECUTOR_KEY=executor-example-express
# 调度中心地址
XXL_JOB_SCHEDULE_CENTER_URL=http://127.0.0.1:8080/xxl-job-admin
# 请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
XXL_JOB_ACCESS_TOKEN=9217CF7406F643BEB71CC00731129CC9
# 任务执行日志的存储路径
XXL_JOB_JOB_LOG_PATH=logs/job
# 执行器运行日志开关(非任务执行日志)，默认关闭
XXL_JOB_DEBUG_LOG=true
```

3.应用组件

```javascript
const XxlJobExecutor = require('xxl-job-executor-nodejs')
const jobHandlers = new Map([ [ 'demoJobHandler', demoJobHandler ] ])
const context = { /*anything*/ }
const xxlJobExecutor = new XxlJobExecutor(jobHandlers, context)
await xxlJobExecutor.applyMiddleware({ app, appType, appDomain, path })
```

具体用法参考 `examples/express.js`、`examples/koa.js` 以及源码中相应的注释。

---

### Examples

examples 目录提供了 `express` 和 `koa` 应用的集成示例

运行示例：

```shell
yarn express # 启动一个 express 服务注册到调度中心
yarn koa # 启动一个 koa 服务注册到调度中心
```

效果截图：

![](./examples/screenshot/preview.png)
