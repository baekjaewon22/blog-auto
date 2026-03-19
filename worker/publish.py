"""네이버 블로그 글 발행 자동화 스크립트.

사용법:
    python publish.py --config '{"postId":"post_001","accountId":"my_account",
        "blogId":"myblog","title":"글 제목","content":"<p>본문</p>",
        "category":"일상","tags":["태그1"],"images":[],"visibility":"public"}'
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from utils.stealth import (
    create_stealth_browser,
    create_stealth_context,
    save_cookies,
    load_cookies,
)
from utils.editor import (
    wait_for_editor_ready,
    set_title,
    set_content,
    select_category,
    set_tags,
    upload_images,
    set_visibility,
    click_publish,
    load_config,
)
from utils.screenshot import capture_screenshot


LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "logs" / "publish_log.json"


def append_log(entry: dict):
    """발행 로그를 JSON 파일에 추가한다."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    logs = []
    if LOG_PATH.exists():
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            try:
                logs = json.load(f)
            except json.JSONDecodeError:
                logs = []

    logs.append(entry)

    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)


async def publish_post(config_data: dict) -> dict:
    """네이버 블로그에 글을 발행한다.

    Args:
        config_data: 발행 설정 딕셔너리
            - postId: 글 ID
            - accountId: 계정 ID
            - blogId: 블로그 ID
            - title: 글 제목
            - content: HTML 본문
            - category: 카테고리명 (선택)
            - tags: 태그 리스트 (선택)
            - images: 이미지 경로 리스트 (선택)
            - visibility: 공개 설정 (선택, 기본 "public")

    Returns:
        발행 결과 딕셔너리
    """
    account_id = config_data["accountId"]
    blog_id = config_data["blogId"]
    post_id = config_data.get("postId", "unknown")

    # 쿠키 확인
    cookies = load_cookies(account_id)
    if not cookies:
        return {
            "postId": post_id,
            "success": False,
            "error": f"계정 '{account_id}'의 저장된 쿠키가 없습니다. 먼저 로그인해 주세요.",
            "timestamp": datetime.now().isoformat(),
        }

    editor_config = load_config()
    post_write_url = editor_config["selectors"]["post_write_url"].format(blog_id=blog_id)

    pw, browser = await create_stealth_browser(headless=True)

    try:
        context = await create_stealth_context(browser, account_id)
        page = await context.new_page()

        # 글쓰기 페이지로 이동
        await page.goto(post_write_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # 로그인 상태 확인 (로그인 페이지로 리다이렉트되면 실패)
        if "nidlogin" in page.url:
            screenshot_path = await capture_screenshot(page, f"login_expired_{post_id}")
            return {
                "postId": post_id,
                "success": False,
                "error": "세션이 만료되었습니다. 재로그인이 필요합니다.",
                "screenshot": screenshot_path,
                "timestamp": datetime.now().isoformat(),
            }

        # 에디터 로딩 대기
        try:
            await wait_for_editor_ready(page)
        except Exception as e:
            screenshot_path = await capture_screenshot(page, f"editor_load_{post_id}")
            return {
                "postId": post_id,
                "success": False,
                "error": f"에디터 로딩 실패: {str(e)}",
                "screenshot": screenshot_path,
                "timestamp": datetime.now().isoformat(),
            }

        # 제목 입력
        await set_title(page, config_data["title"])

        # 카테고리 선택
        category = config_data.get("category")
        if category:
            await select_category(page, category)

        # 본문 입력
        await set_content(page, config_data["content"])

        # 이미지 업로드
        images = config_data.get("images", [])
        if images:
            await upload_images(page, images)

        # 태그 입력
        tags = config_data.get("tags", [])
        if tags:
            await set_tags(page, tags)

        # 공개 설정
        visibility = config_data.get("visibility", "public")
        await set_visibility(page, visibility)

        # 발행
        success = await click_publish(page)

        if success:
            published_url = page.url
            # 쿠키 갱신 저장
            await save_cookies(context, account_id)

            result = {
                "postId": post_id,
                "success": True,
                "url": published_url,
                "timestamp": datetime.now().isoformat(),
            }
        else:
            screenshot_path = await capture_screenshot(page, f"publish_fail_{post_id}")
            result = {
                "postId": post_id,
                "success": False,
                "error": "발행 버튼 클릭 후 완료를 확인할 수 없습니다.",
                "screenshot": screenshot_path,
                "timestamp": datetime.now().isoformat(),
            }

    except Exception as e:
        try:
            screenshot_path = await capture_screenshot(page, f"error_{post_id}")
        except Exception:
            screenshot_path = None

        result = {
            "postId": post_id,
            "success": False,
            "error": str(e),
            "screenshot": screenshot_path,
            "timestamp": datetime.now().isoformat(),
        }

    finally:
        await browser.close()
        await pw.stop()

    return result


def main():
    parser = argparse.ArgumentParser(description="네이버 블로그 글 발행")
    parser.add_argument(
        "--config",
        required=True,
        help="발행 설정 JSON 문자열",
    )
    args = parser.parse_args()

    config_data = json.loads(args.config)
    result = asyncio.run(publish_post(config_data))

    # 로그 기록
    append_log(result)

    # 결과 출력
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
