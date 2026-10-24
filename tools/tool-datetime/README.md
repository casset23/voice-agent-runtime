# tool-datetime

查询当前时间日期的工具。


### 示例

path: /v1/invoke/date

#### 请求
```
{
  "parameters": { "day_offset": 0 },
  "metadata": {
    "time_zone": "Asia/Shanghai",
    "timestamp": 175302721111,
    "platform": "demo-speaker-v1",
    "device_version": "v1.2.0"
  },
  "session_id": "f9f5f14a-9910-4317-b7bd-ed883a1bb053"
}
```

#### 响应
```
{
  "tool": {
    "name": "tool-datetime",
    "category": "date",
    "version": "0.1.0",
    "vendor": "internal"
  },
  "result": {
    "data": {
      "date": "2025-07-23",
      "weekday": "星期三",
      "holiday": null
    },
    "text": "后天是2025年7月23日，星期三。",
    "needs_utterance": false
  },
  "metadata": {
    "time_zone": "Asia/Shanghai",
    "timestamp": 1753092403054,
    "platform": "demo-speaker-v1",
    "device_version": "v1.2.0"
  },
  "session_id": "f9f5f14a-9910-4317-b7bd-ed883a1bb053"
}
````