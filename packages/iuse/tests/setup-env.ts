// ink（经 is-in-ci）在 CI 环境下停止刷新中间帧，lastFrame 卡在首帧，
// 时序断言全部失效——测试关心的是终端行为本身，与运行环境无关，
// 在 ink 加载前擦掉 CI 探测面，让本地与 CI 渲染路径一致。
delete process.env.CI
delete process.env.GITHUB_ACTIONS
delete process.env.CONTINUOUS_INTEGRATION
delete process.env.BUILD_NUMBER
delete process.env.RUN_ID
