"""네이버 스마트에디터 조작 헬퍼 모듈."""

import json
from pathlib import Path

from playwright.async_api import Page

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"


def load_config() -> dict:
    """config.json에서 셀렉터 설정을 로드한다."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


async def wait_for_editor_ready(page: Page, timeout: int = 30000):
    """스마트에디터가 로드될 때까지 대기한다."""
    # 에디터 영역이 나타날 때까지 대기
    await page.wait_for_selector(".se-content", timeout=timeout)
    # 추가 로딩 대기
    await page.wait_for_timeout(2000)


async def set_title(page: Page, title: str):
    """글 제목을 입력한다."""
    config = load_config()
    title_selector = config["selectors"]["editor"]["post_title"]

    # 제목 영역 클릭 후 입력
    title_el = page.locator(title_selector)
    await title_el.click()
    await page.wait_for_timeout(500)
    await page.keyboard.type(title, delay=50)


async def set_content(page: Page, html_content: str):
    """본문에 HTML 콘텐츠를 삽입한다.

    네이버 스마트에디터는 직접 HTML 삽입이 제한적이므로,
    클립보드를 통한 붙여넣기 방식을 사용한다.
    """
    # 본문 영역 클릭
    content_area = page.locator(".se-component-content .se-text-paragraph")
    await content_area.first.click()
    await page.wait_for_timeout(500)

    # HTML 콘텐츠를 클립보드에 복사 후 붙여넣기
    await page.evaluate(f"""() => {{
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', {json.dumps(html_content)});
        clipboardData.setData('text/plain', {json.dumps(html_content)});
        const pasteEvent = new ClipboardEvent('paste', {{
            bubbles: true,
            cancelable: true,
            clipboardData: clipboardData
        }});
        document.querySelector('.se-component-content .se-text-paragraph').dispatchEvent(pasteEvent);
    }}""")
    await page.wait_for_timeout(1000)


async def select_category(page: Page, category_name: str):
    """카테고리를 선택한다."""
    config = load_config()
    cat_button = config["selectors"]["editor"]["category_button"]

    # 카테고리 버튼 클릭
    await page.locator(cat_button).click()
    await page.wait_for_timeout(1000)

    # 카테고리 목록에서 해당 이름 클릭
    category_item = page.locator(f"text={category_name}")
    if await category_item.count() > 0:
        await category_item.first.click()
        await page.wait_for_timeout(500)


async def set_tags(page: Page, tags: list[str]):
    """태그를 입력한다."""
    config = load_config()
    tag_selector = config["selectors"]["editor"]["tag_input"]

    tag_input = page.locator(tag_selector)
    for tag in tags:
        await tag_input.click()
        await tag_input.fill(tag)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(300)


async def upload_images(page: Page, image_paths: list[str]):
    """이미지를 업로드한다."""
    if not image_paths:
        return

    for image_path in image_paths:
        # 이미지 추가 버튼 클릭
        image_button = page.locator(".se-image-toolbar-button, .se-toolbar-button-image")
        if await image_button.count() > 0:
            await image_button.first.click()
            await page.wait_for_timeout(1000)

            # 파일 input에 이미지 경로 설정
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                await file_input.set_input_files(image_path)
                await page.wait_for_timeout(2000)


async def set_visibility(page: Page, visibility: str = "public"):
    """공개 설정을 변경한다.

    Args:
        visibility: "public", "neighbor", "private" 중 하나
    """
    config = load_config()
    selectors = config["selectors"]["editor"]

    visibility_map = {
        "public": selectors["visibility_public"],
        "neighbor": selectors["visibility_neighbor"],
        "private": selectors["visibility_private"],
    }

    selector = visibility_map.get(visibility, selectors["visibility_public"])
    vis_el = page.locator(selector)
    if await vis_el.count() > 0:
        await vis_el.click()
        await page.wait_for_timeout(500)


async def click_publish(page: Page) -> bool:
    """발행 버튼을 클릭하고 결과를 확인한다.

    Returns:
        발행 성공 여부
    """
    config = load_config()
    selectors = config["selectors"]["editor"]

    # 발행 버튼 클릭
    publish_btn = page.locator(selectors["publish_button"])
    await publish_btn.click()
    await page.wait_for_timeout(2000)

    # 확인 다이얼로그가 있으면 클릭
    confirm_btn = page.locator(selectors["publish_confirm"])
    if await confirm_btn.count() > 0:
        await confirm_btn.click()

    # 발행 완료 대기 (URL 변경 감지)
    try:
        await page.wait_for_url("**/PostView**", timeout=15000)
        return True
    except Exception:
        # PostList로 리다이렉트 되는 경우도 있음
        try:
            await page.wait_for_url("**/PostList**", timeout=5000)
            return True
        except Exception:
            return False
