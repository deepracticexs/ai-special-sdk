Feature: 异步任务系统
  所有 API 支持异步调用，立即返回 taskId，不阻塞。
  可以同时跑多个任务，实时监听各自进度。

  Scenario: 同时发起多个招募任务
    Given 服务已就绪
    When 我同时发起 2 个招募任务
    Then 应该立即返回 2 个不同的 taskId
    And 等待完成后每个任务都有结果
    And 每个任务都有完整的步骤记录

  Scenario: 自定义步骤
    Given 服务已就绪
    When 我发起一个招募任务并添加自定义步骤
    Then 任务的步骤中应该包含自定义步骤
