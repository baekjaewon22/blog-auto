"""네이버 블로그 카테고리 목록 스크래핑 스크립트.

사용법:
    python category_fetcher.py --account-id my_account --blog-id myblog
"""

import argparse
import asyncio
import json
import sys

from utils.stealth import (
    create_stealth_browser,
    create_stealth_context,
    load_cookies,
)


async def fetch_categories(account_id: str, blog_id: str) -> dict:
    """블로그의 카테고리 목록을 가져온다.

    Returns:
        {"success": bool, "categories": [{"name": str, "id": str}], "error": str | None}
    """
    cookies = load_cookies(account_id)
    if not cookies:
        return {
            "success": False,
            "categories": [],
            "error": f"계정 '{account_id}'의 저장된 쿠키가 없습니다.",
        }

    pw, browser = await create_stealth_browser(headless=True)

    try:
        context = await create_stealth_context(browser, account_id)
        page = await context.new_page()

        # 블로그 관리 페이지에서 카테고리 목록 가져오기
        url = f"https://blog.naver.com/PostList.naver?blogId={blog_id}"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # 카테고리 목록 추출
        categories = await page.evaluate("""() => {
            const items = document.querySelectorAll('.category_item, .blog2_categorylist a');
            return Array.from(items).map((el, idx) => ({
                name: el.textContent.trim().replace(/\\(\\d+\\)$/, '').trim(),
                id: el.getAttribute('data-category-no') || String(idx),
            })).filter(c => c.name && c.name !== '전체');
        }""")

        if not categories:
            # 대체 방법: API를 통해 카테고리 가져오기
            api_url = f"https://blog.naver.com/BlogCategoryListAsync.naver?blogId={blog_id}"
            response = await page.goto(api_url)
            if response and response.ok:
                text = await response.text()
                try:
                    data = json.loads(text)
                    categories = [
                        {"name": cat.get("categoryName", ""), "id": str(cat.get("categoryNo", ""))}
                        for cat in data.get("result", {}).get("categoryList", [])
                        if cat.get("categoryName")
                    ]
                except (json.JSONDecodeError, KeyError):
                    pass

        return {
            "success": True,
            "categories": categories,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "categories": [],
            "error": str(e),
        }

    finally:
        await browser.close()
        await pw.stop()


def main():
    parser = argparse.ArgumentParser(description="네이버 블로그 카테고리 조회")
    parser.add_argument("--account-id", required=True, help="계정 식별자")
    parser.add_argument("--blog-id", required=True, help="블로그 ID")
    args = parser.parse_args()

    result = asyncio.run(fetch_categories(args.account_id, args.blog_id))
    print(json.dumps(result, ensure_ascii=True, indent=2))
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
