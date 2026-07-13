# 省流助手 v3.0

Codex cost-saving configuration and tools.

## 快速部署
```powershell
git clone https://github.com/a1838436742-crypto/sheng-liu-assistant.git
cd sheng-liu-assistant
cp config.template.json config.json  # 填上你的 API Key
```
然后把 `AGENTS.md` 放到 Codex 项目根目录，告诉 Codex "按铁律0部署"。

## What's inside
- `AGENTS.md` - 铁律规则
- `*.js` / `*.py` - 核心脚本（GLM代理、审计、缓存优化等）
- `skills/douyin-transcriber/` - 抖音视频转文字技能
- `templates/` - 模板文件
