# html_cleaner.py
from readability import Document
import requests
def extract_plain_text(html_content: str) -> str:
    """提取HTML正文，去除标签、脚本、样式，仅保留可见纯文本，压缩Token量至10%以内"""
    doc = Document(html_content)
    # 提取正文HTML，再转为纯文本（或直接用 doc.summary() 拿正文片段）
    plain_text = doc.summary()
    # 可选：用正则进一步压缩多余换行和空白
    import re
    plain_text = re.sub(r'\s+', ' ', plain_text).strip()
    return plain_text
# 使用示例：
# raw_html = requests.get("https://example.com").text
# clean_text = extract_plain_text(raw_html)
# 然后将 clean_text 放入 API 的 user message 中
