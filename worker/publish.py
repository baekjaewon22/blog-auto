"""네이버 블로그 글 발행 자동화 스크립트.

설정(settings)과 API 키(apiKeys)를 받아서:
1. AI 포스팅: 등록된 프롬프트로 콘텐츠를 AI가 변환
2. 이미지 자동 삽입: 시작/마무리 폴더에서 랜덤 이미지 삽입
3. 구분선 삽입: 설정된 스타일로 본문에 구분선 추가
4. 발행 간격/일일 제한: 설정값 적용

사용법:
    python publish.py --config '{"postId":"...", "settings":{...}, "apiKeys":{...}}'
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
from utils.ai_helper import generate_ai_content
from utils.image_folder import get_random_image
from utils.separator import get_separator_html


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


def preprocess_content(config_data: dict) -> tuple[str, list[str]]:
    """설정에 따라 콘텐츠를 전처리한다.

    1. AI 포스팅으로 콘텐츠 변환
    2. 구분선 삽입
    3. 시작/마무리 이미지 수집

    Returns:
        (변환된 HTML 콘텐츠, 이미지 경로 리스트)
    """
    content = config_data.get("content", "")
    settings = config_data.get("settings", {})
    api_keys = config_data.get("apiKeys", {})
    images = list(config_data.get("images", []))

    # ─── AI 포스팅 1: 콘텐츠 변환 ───
    ai1 = settings.get("aiPosting1", {})
    if ai1.get("enabled") and ai1.get("prompt"):
        model = settings.get("openai", {}).get("model", "gpt-4")
        print(f"[AI1] 콘텐츠 변환 중... (모델: {model})", file=sys.stderr)
        content = generate_ai_content(api_keys, model, ai1["prompt"], content)

    # ─── AI 포스팅 2: 추가 변환 ───
    ai2 = settings.get("aiPosting2", {})
    if ai2.get("enabled") and ai2.get("prompt"):
        model = settings.get("openai", {}).get("model", "gpt-4")
        print(f"[AI2] 추가 변환 중... (모델: {model})", file=sys.stderr)
        content = generate_ai_content(api_keys, model, ai2["prompt"], content)

    # ─── 구분선 삽입 ───
    posting = settings.get("posting", {})
    separator_style = posting.get("separatorStyle", "quote")
    separator_html = get_separator_html(separator_style)

    # ─── 이미지 폴더에서 자동 이미지 수집 ───
    # 서버 업로드 폴더 (data/images/start, data/images/end)
    data_dir = Path(__file__).resolve().parent.parent / "data" / "images"
    start_folder = str(data_dir / "start")
    end_folder = str(data_dir / "end")
    auto_image = posting.get("autoImageInsert", False)

    start_image = None
    end_image = None

    if auto_image:
        start_image = get_random_image(start_folder)
        if start_image:
            print(f"[이미지] 시작 이미지: {start_image}", file=sys.stderr)
        end_image = get_random_image(end_folder)
        if end_image:
            print(f"[이미지] 마무리 이미지: {end_image}", file=sys.stderr)

    # ─── 최종 콘텐츠 조합 ───
    # 이미지는 에디터에서 순서대로 삽입: 시작이미지 → 본문 → 마무리이미지
    start_images = [start_image] if start_image else []
    end_images = [end_image] if end_image else []

    # 본문 + 구분선
    parts = [content, separator_html]
    final_content = "\n".join(parts)

    return final_content, start_images, end_images


def _handle_dialog(dialog, messages: list):
    """alert/confirm 다이얼로그를 캡처하고 자동 수락한다."""
    msg = dialog.message
    messages.append(msg)
    print(f"[다이얼로그] {dialog.type}: {msg}", file=sys.stderr)
    asyncio.ensure_future(dialog.accept())


async def publish_post(config_data: dict) -> dict:
    """네이버 블로그에 글을 발행한다."""
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

    # 콘텐츠 전처리 (AI 변환 + 이미지 + 구분선)
    print("[전처리] 콘텐츠 전처리 시작...", file=sys.stderr)
    final_content, start_images, end_images = preprocess_content(config_data)
    print("[전처리] 콘텐츠 전처리 완료", file=sys.stderr)

    editor_config = load_config()
    post_write_url = editor_config["selectors"]["post_write_url"].format(blog_id=blog_id)

    pw, browser = await create_stealth_browser(headless=False)

    try:
        context = await create_stealth_context(browser, account_id)
        page = await context.new_page()

        # alert/confirm 다이얼로그 캡처
        dialog_messages = []
        page.on("dialog", lambda dialog: _handle_dialog(dialog, dialog_messages))

        # 글쓰기 페이지로 이동
        await page.goto(post_write_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # 로그인 상태 확인
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

        # 시작 이미지 업로드 (본문 앞)
        if start_images:
            await upload_images(page, start_images)

        # 본문 입력
        await set_content(page, final_content)

        # 마무리 이미지 업로드 (본문 뒤)
        if end_images:
            await upload_images(page, end_images)

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
            # 에러 스크린샷 + 페이지 내 알림/팝업 텍스트 캡처
            screenshot_path = await capture_screenshot(page, f"error_{post_id}")

            # 네이버 에디터의 에러 메시지/팝업 텍스트 수집
            error_detail = str(e)
            try:
                frame = page.frames[1] if len(page.frames) > 1 else page.main_frame
                popup_texts = await frame.evaluate("""() => {
                    const msgs = [];
                    // alert 팝업, 레이어 팝업, 에러 메시지 등
                    document.querySelectorAll('.layer_popup, .alert, .error, [class*=alert], [class*=error], [class*=popup], [class*=modal], [class*=toast]').forEach(el => {
                        if (el.textContent.trim()) msgs.push(el.textContent.trim().substring(0, 200));
                    });
                    return msgs;
                }""")
                if popup_texts:
                    error_detail += f" | 팝업: {'; '.join(popup_texts)}"
            except Exception:
                pass

            print(f"[에러] {error_detail}", file=sys.stderr)
        except Exception:
            screenshot_path = None
            error_detail = str(e)

        result = {
            "postId": post_id,
            "success": False,
            "error": error_detail,
            "screenshot": screenshot_path,
            "timestamp": datetime.now().isoformat(),
        }

    finally:
        # 에러 시 30초 대기 (디버깅용 — 브라우저 화면 확인 가능)
        if not result.get("success"):
            if dialog_messages:
                result["error"] = result.get("error", "") + f" | 다이얼로그: {'; '.join(dialog_messages)}"
            print(f"[대기] 에러 확인을 위해 30초 대기... ({result.get('error', '')})", file=sys.stderr)
            await asyncio.sleep(30)
        await browser.close()
        await pw.stop()

    return result


def main():
    parser = argparse.ArgumentParser(description="네이버 블로그 글 발행")
    parser.add_argument("--config", required=True, help="발행 설정 JSON 문자열")
    args = parser.parse_args()

    config_data = json.loads(args.config)
    result = asyncio.run(publish_post(config_data))

    # 로그 기록
    append_log(result)

    # 결과 출력 (stdout = JSON만)
    print(json.dumps(result, ensure_ascii=True, indent=2))
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
