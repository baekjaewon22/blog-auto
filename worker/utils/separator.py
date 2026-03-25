"""블로그 구분선 HTML 생성기."""

import random

SEPARATORS = {
    "quote": '<blockquote style="margin:20px 0;padding:10px 20px;border-left:4px solid #ddd;color:#666;font-style:italic;">✦ ✦ ✦</blockquote>',

    "vertical": '<div style="text-align:center;margin:20px 0;"><span style="display:inline-block;width:1px;height:40px;background:#ccc;"></span></div>',

    "bubble": '<div style="text-align:center;margin:20px 0;padding:12px 24px;background:#f5f5f5;border-radius:20px;display:inline-block;color:#888;font-size:14px;">~ * ~</div>',

    "line_quote": '<div style="text-align:center;margin:20px 0;"><hr style="border:none;border-top:1px solid #ddd;margin-bottom:8px;"><span style="color:#999;font-size:13px;">"</span><hr style="border:none;border-top:1px solid #ddd;margin-top:8px;"></div>',
}


def get_separator_html(style: str = "quote") -> str:
    """구분선 스타일에 따른 HTML을 반환한다.

    Args:
        style: "random", "quote", "vertical", "bubble", "line_quote"

    Returns:
        구분선 HTML 문자열
    """
    if style == "random":
        style = random.choice(list(SEPARATORS.keys()))

    return SEPARATORS.get(style, SEPARATORS["quote"])
