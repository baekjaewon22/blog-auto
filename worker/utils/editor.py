"""네이버 스마트에디터 조작 헬퍼 모듈.

네이버 블로그 에디터는 iframe(PostWriteForm) 안에 있으며,
팝업이 자주 뜨므로 매 동작 전 팝업을 닫아야 한다.
"""

import json
import sys
from pathlib import Path

from playwright.async_api import Page, Frame

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


async def get_editor_frame(page: Page) -> Frame:
    """에디터 iframe을 찾아 반환한다."""
    for frame in page.frames:
        if "PostWriteForm" in frame.url or "postwrite" in frame.url.lower():
            return frame
    return page.main_frame


async def close_all_popups(page: Page):
    """모든 프레임에서 열려있는 팝업/오버레이를 닫는다."""
    for f in page.frames:
        # 1) "작성 중인 글이 있습니다" 복원 팝업
        cancel = f.locator(".se-popup-button-cancel")
        if await cancel.count() > 0 and await cancel.first.is_visible():
            await cancel.first.click()
            await page.wait_for_timeout(1500)
            print("[팝업] 글 복원 팝업 닫기 (취소)", file=sys.stderr)
            continue

        # 2) 사진 첨부 방식 팝업 — "개별사진" 클릭
        photo_popup = f.locator('[data-name="se-popup-image-type"]')
        if await photo_popup.count() > 0 and await photo_popup.first.is_visible():
            # 첫 번째 옵션(개별사진) 클릭
            first_option = f.locator('.se-popup-image-type .se-popup-image-type-item, .se-popup-image-type li, .se-popup-image-type [class*="item"]')
            if await first_option.count() > 0:
                await first_option.first.click()
                await page.wait_for_timeout(2000)
                print("[팝업] 사진 첨부 방식: 첫 번째 옵션 선택", file=sys.stderr)
                continue
            # 옵션 못 찾으면 X로 닫기
            close = f.locator('.se-popup-image-type .se-popup-close-button')
            if await close.count() > 0:
                await close.first.click()
                await page.wait_for_timeout(1000)
                print("[팝업] 사진 첨부 방식 팝업 닫기 (X)", file=sys.stderr)
                continue

        # 3) 기타 se-popup-dim 오버레이
        dim = f.locator(".se-popup-dim")
        if await dim.count() > 0 and await dim.first.is_visible():
            # 팝업 내 닫기 버튼
            for sel in [".se-popup-close-button", ".se-popup-button-cancel"]:
                btn = f.locator(sel)
                if await btn.count() > 0 and await btn.first.is_visible():
                    await btn.first.click()
                    await page.wait_for_timeout(1000)
                    print(f"[팝업] 오버레이 닫기: {sel}", file=sys.stderr)
                    break

    # 4) 도움말 패널 닫기
    for f in page.frames:
        help_close = f.locator(".se-help-panel-close-button")
        if await help_close.count() > 0 and await help_close.first.is_visible():
            # 팝업이 가로막지 않을 때만 클릭
            try:
                await help_close.first.click(timeout=3000)
                await page.wait_for_timeout(500)
                print("[팝업] 도움말 닫기", file=sys.stderr)
            except Exception:
                pass


async def wait_for_editor_ready(page: Page, timeout: int = 30000):
    """스마트에디터가 로드될 때까지 대기한다."""
    frame = await get_editor_frame(page)

    await frame.wait_for_selector(
        ".se-documentTitle, .se-text-paragraph, textarea",
        timeout=timeout,
    )
    await page.wait_for_timeout(2000)
    await close_all_popups(page)
    await page.wait_for_timeout(1000)
    print("[에디터] 에디터 로딩 완료", file=sys.stderr)


async def set_title(page: Page, title: str):
    """글 제목을 입력한다."""
    frame = await get_editor_frame(page)
    await close_all_popups(page)

    # 제목 영역 클릭 — 정확한 셀렉터
    title_el = frame.locator(".se-documentTitle .se-text-paragraph")
    if await title_el.count() > 0:
        await title_el.first.click(timeout=5000)
        await page.wait_for_timeout(500)
        await page.keyboard.type(title, delay=30)
        print(f"[에디터] 제목 입력 완료: {title[:30]}", file=sys.stderr)
        return

    # 대체: placeholder로 찾기
    ph = frame.locator("[placeholder*='제목']")
    if await ph.count() > 0:
        await ph.first.click()
        await page.keyboard.type(title, delay=30)
        return

    print("[에디터] 제목 영역을 찾을 수 없음", file=sys.stderr)


async def set_content(page: Page, html_content: str):
    """본문에 콘텐츠를 삽입한다. 현재 커서 위치에 타이핑."""
    # 커서를 본문 끝으로 이동 (이미지가 있으면 이미지 뒤)
    await page.keyboard.press("End")
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(500)

    # HTML 태그 제거하여 순수 텍스트로 입력
    import re
    plain = re.sub(r'<[^>]+>', '\n', html_content)
    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()

    await page.keyboard.type(plain, delay=10)
    await page.wait_for_timeout(1000)
    print("[에디터] 본문 입력 완료", file=sys.stderr)


async def select_category(page: Page, category_name: str):
    """카테고리를 선택한다."""
    frame = await get_editor_frame(page)
    await close_all_popups(page)

    cat_btn = frame.locator("[class*='category'], button:has-text('카테고리')")
    if await cat_btn.count() > 0:
        for i in range(await cat_btn.count()):
            if await cat_btn.nth(i).is_visible():
                await cat_btn.nth(i).click()
                await page.wait_for_timeout(1000)
                item = frame.locator(f"text={category_name}")
                if await item.count() > 0:
                    await item.first.click()
                    await page.wait_for_timeout(500)
                    print(f"[에디터] 카테고리 선택: {category_name}", file=sys.stderr)
                    return
                break

    print(f"[에디터] 카테고리 '{category_name}' 선택 실패", file=sys.stderr)


async def set_tags(page: Page, tags: list[str]):
    """태그를 입력한다."""
    frame = await get_editor_frame(page)
    await close_all_popups(page)

    tag_input = frame.locator("input[placeholder*='태그'], .tag_inner input, [class*='tag'] input")
    if await tag_input.count() > 0:
        for tag in tags:
            await tag_input.first.click()
            await tag_input.first.fill(tag)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(300)
        print(f"[에디터] 태그 입력: {', '.join(tags)}", file=sys.stderr)
        return

    print("[에디터] 태그 입력 실패", file=sys.stderr)


async def upload_images(page: Page, image_paths: list[str]):
    """이미지를 업로드한다. file_chooser로 파일 다이얼로그를 가로챈다."""
    if not image_paths:
        return

    frame = await get_editor_frame(page)
    await close_all_popups(page)

    # 사진 추가 버튼 = se-image-toolbar-button
    img_btn = frame.locator(".se-image-toolbar-button")
    if await img_btn.count() == 0:
        print("[에디터] 사진 업로드 버튼을 찾을 수 없음", file=sys.stderr)
        return

    try:
        async with page.expect_file_chooser(timeout=10000) as fc_info:
            await img_btn.first.click()
        file_chooser = await fc_info.value
        await file_chooser.set_files(image_paths)
        print(f"[에디터] 이미지 업로드: {len(image_paths)}개", file=sys.stderr)
    except Exception as e:
        print(f"[에디터] 이미지 업로드 실패: {e}", file=sys.stderr)
        return

    await page.wait_for_timeout(5000)

    # "사진 첨부 방식" 팝업 자동 처리
    await close_all_popups(page)
    await page.wait_for_timeout(2000)

    # 이미지 뒤로 커서 이동
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("End")
    await page.wait_for_timeout(500)


async def set_visibility(page: Page, visibility: str = "public"):
    """공개 설정 — 발행 시 처리."""
    pass


async def click_publish(page: Page) -> bool:
    """발행 버튼을 클릭하고 결과를 확인한다."""
    frame = await get_editor_frame(page)
    await close_all_popups(page)
    await page.wait_for_timeout(1000)

    # 1단계: 발행 버튼 클릭 (data-click-area="tpb.publish")
    publish_btn = frame.locator('[data-click-area="tpb.publish"]')
    if await publish_btn.count() == 0:
        publish_btn = frame.locator("button[class*='publish_btn']")
    if await publish_btn.count() == 0:
        print("[에디터] 발행 버튼을 찾을 수 없음", file=sys.stderr)
        return False

    await publish_btn.first.click()
    await page.wait_for_timeout(2000)
    print("[에디터] 발행 설정 패널 열기", file=sys.stderr)

    # 2단계: 발행 확인 버튼 (발행 패널 내)
    confirm_selectors = [
        '[data-click-area="pmy*b.publish"]',      # 최종 발행 버튼
        'button[class*="confirm_btn"]',
        '.publish_layer button[class*="publish"]',
    ]

    for sel in confirm_selectors:
        btn = frame.locator(sel)
        if await btn.count() > 0:
            for i in range(await btn.count()):
                if await btn.nth(i).is_visible():
                    await btn.nth(i).click()
                    print(f"[에디터] 발행 확인: {sel}", file=sys.stderr)
                    break
            break

    # 3단계: 발행 완료 대기
    try:
        await page.wait_for_url("**/PostView**", timeout=20000)
        print("[에디터] 발행 완료 — PostView", file=sys.stderr)
        return True
    except Exception:
        pass

    try:
        await page.wait_for_url("**/PostList**", timeout=5000)
        print("[에디터] 발행 완료 — PostList", file=sys.stderr)
        return True
    except Exception:
        pass

    await page.wait_for_timeout(3000)
    current = page.url.lower()
    if "postwrite" not in current and "goblogwrite" not in current:
        print(f"[에디터] 발행 완료 추정 — {page.url}", file=sys.stderr)
        return True

    return False
