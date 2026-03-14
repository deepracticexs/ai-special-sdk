Feature: 招募内容生成
  一个 API 搞定图文全套。
  三步串联：用户需求 → Claude 生文案 → Claude 转图片提示词 → Gemini 生海报。

  Scenario: 生成小红书月嫂招募图文
    Given 文本和图片生成服务已就绪
    When 我请求生成招募内容:
      | position  | 月嫂              |
      | region    | 上海              |
      | salary    | 8000-15000元/月    |
      | contact   | 13800138000       |
      | platform  | 小红书             |
    Then 应该返回文案和海报
    And 进度事件应该按三步依次触发
