"""Playwright stealth 설정 모듈."""

import json
from pathlib import Path
from playwright.async_api import async_playwright, Browser, BrowserContext


COOKIES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "accounts"


async def create_stealth_browser(headless: bool = False) -> tuple:
    """봇 탐지를 우회하는 stealth 브라우저를 생성한다.

    Returns:
        (playwright, browser) 튜플
    """
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ],
    )
    return pw, browser


async def create_stealth_context(
    browser: Browser,
    account_id: str | None = None,
) -> BrowserContext:
    """stealth 설정이 적용된 브라우저 컨텍스트를 생성한다.

    account_id가 제공되면 저장된 쿠키를 로드한다.
    """
    context = await browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        locale="ko-KR",
        timezone_id="Asia/Seoul",
    )

    # webdriver 속성 제거
    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
        window.chrome = { runtime: {} };
    """)

    # 저장된 쿠키 로드
    if account_id:
        cookies = load_cookies(account_id)
        if cookies:
            await context.add_cookies(cookies)

    return context


def get_cookies_path(account_id: str) -> Path:
    """계정별 쿠키 파일 경로를 반환한다."""
    return COOKIES_DIR / account_id / "cookies.json"


def load_cookies(account_id: str) -> list[dict] | None:
    """저장된 쿠키를 로드한다."""
    path = get_cookies_path(account_id)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def save_cookies(context: BrowserContext, account_id: str) -> Path:
    """현재 컨텍스트의 쿠키를 파일로 저장한다."""
    path = get_cookies_path(account_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    cookies = await context.cookies()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    return path
