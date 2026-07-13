# HTML Cleaner - 提取网页纯文本
import re

def clean_html(html):
    # 移除 script 和 style
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # 移除 HTML 标签
    html = re.sub(r'<[^>]+>', ' ', html)
    # 合并空白
    html = re.sub(r'\s+', ' ', html)
    return html.strip()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            print(clean_html(f.read()))
