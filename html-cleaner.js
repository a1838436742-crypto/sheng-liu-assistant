// html-cleaner.js
// 【省流铁律 · 铁律1】Node.js HTML正文提取（@mozilla/readability + jsdom）
// 安装: npm install @mozilla/readability jsdom
//
// 用法:
//   const clean = require("./html-cleaner");
//   const text = clean.extractPlainText(rawHtml);
//   或 const text = await clean.extractFromUrl("https://...");

const re = require;

class HtmlCleaner {
  /**
   * 从HTML提取正文纯文本
   * @param {string} html - 原始HTML
   * @param {object} options
   * @param {number} options.ratio - 目标压缩比例，默认0.1(10%)
   * @param {boolean} options.useReadability - 是否使用Readability，默认true
   * @returns {string} 清洗后的纯文本
   */
  extractPlainText(html, options = {}) {
    const ratio = options.ratio ?? 0.1;
    const useReadability = options.useReadability !== false;
    const originalSize = html.length;
    let text;

    try {
      if (useReadability) {
        text = this._readabilityExtract(html);
      } else {
        text = this._regexExtract(html);
      }
    } catch (e) {
      console.warn(`[铁律1] Readability失败，降级正则: ${e.message}`);
      text = this._regexExtract(html);
    }

    // 压缩空白
    text = text.replace(/\s+/g, ' ').trim();

    // 超比例截断
    const maxLen = Math.floor(originalSize * ratio);
    if (text.length > maxLen) {
      const headEnd = Math.floor(maxLen * 0.6);
      const tailStart = text.length - Math.floor(maxLen * 0.4);
      text = text.substring(0, headEnd)
        + '\n\n...(中间内容省略)...\n\n'
        + text.substring(tailStart);
    }

    const pct = originalSize > 0 ? (text.length / originalSize * 100).toFixed(1) : 0;
    console.log(`[铁律1] HTML压缩: ${originalSize} → ${text.length} 字符 (${pct}%)`);
    return text;
  }

  /**
   * 从URL直接下载并提取
   * @param {string} url
   * @param {object} options
   * @returns {Promise<string|null>}
   */
  async extractFromUrl(url, options = {}) {
    try {
      const https = await import('https');
      const http = await import('http');

      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // 跟随重定向
            return resolve(this.extractFromUrl(res.headers.location, options));
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(this.extractPlainText(data, options)));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
      });
    } catch (e) {
      console.error(`[铁律1] ❌ URL提取失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 使用 @mozilla/readability + jsdom 提取正文
   */
  _readabilityExtract(html) {
    let Readability, JSDOM;

    try {
      Readability = require('@mozilla/readability');
      JSDOM = require('jsdom').JSDOM;
    } catch {
      // 从 node_repl 环境动态导入
      throw new Error('@mozilla/readability 或 jsdom 未安装');
    }

    const doc = new JSDOM(html, { url: 'https://example.com' });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      throw new Error('Readability未能提取到内容');
    }

    return article.textContent;
  }

  /**
   * 正则降级方案
   */
  _regexExtract(html) {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#?\w+;/g, ' ');

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    return [...new Set(lines)].join('\n');
  }
}

module.exports = new HtmlCleaner();
module.exports.HtmlCleaner = HtmlCleaner;

// 独立运行
if (require.main === module) {
  const cleaner = module.exports;
  const testHtml = `<!DOCTYPE html><html><head><title>测试</title>
<script>alert('x')</script><style>.cls{color:red}</style></head>
<body><h1>标题</h1><p>这是一段正文内容。</p><ul><li>项目1</li><li>项目2</li></ul></body></html>`;

  console.log('=== html-cleaner.js 测试 ===\n');
  console.log('测试1: 降级正则模式');
  const r1 = cleaner.extractPlainText(testHtml, { useReadability: false });
  console.log(`结果: ${r1}\n`);

  console.log('测试2: 尝试 Readability（如未安装则自动降级）');
  const r2 = cleaner.extractPlainText(testHtml);
  console.log(`结果: ${r2}\n`);
}
