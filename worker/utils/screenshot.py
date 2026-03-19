"""에러 발생 시 스크린샷 캡처 모듈."""

from datetime import datetime
from pathlib import Path

from playwright.async_api import Page


SCREENSHOTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "logs" / "screenshots"


async def capture_screenshot(page: Page, prefix: str = "error") -> str:
    """현재 페이지의 스크린샷을 캡처하여 저장한다.

    Returns:
        저장된 스크린샷 파일 경로
    """
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.png"
    filepath = SCREENSHOTS_DIR / filename
    await page.screenshot(path=str(filepath), full_page=True)
    return str(filepath)
