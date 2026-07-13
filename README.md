# 省流助手 v3.0

Codex 省流配置与工具集

## 快速开始

```bash
cp config.template.json config.json  # 填入你的 Key
# 然后开 Codex 对话说 "按铁律0部署"
```

## 目录结构

- `AGENTS.md` — 铁律规则（Codex 自动读取）
- `config.template.json` — Key 配置模板
- `glm-proxy.js` — GLM 协议转换代理
- `image-filter-proxy.js` — 图片过滤代理
- `pricing-server.js` — 省流可视化面板
- `full-audit.js` — 全量审计
- `skills/douyin-transcriber/` — 抖音转文字技能
