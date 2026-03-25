"""네이버 로그인 및 쿠키 저장 스크립트.

사용법:
    # 수동 로그인 (브라우저가 열리고 사용자가 직접 로그인)
    python login.py --account-id my_account

    # 세션 상태 확인
    python login.py --account-id my_account --check
"""

import argparse
import asyncio
import json
import sys

from utils.stealth import (
    create_stealth_browser,
    create_stealth_context,
    save_cookies,
    load_cookies,
)


NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login"
NAVER_MYPAGE_URL = "https://my.naver.com"


async def manual_login(account_id: str) -> dict:
    """브라우저를 visible 모드로 열어 사용자가 수동으로 로그인하도록 한다.

    로그인 완료 후 쿠키를 저장한다.

    Returns:
        {"success": bool, "message": str, "cookies_path": str | None}
    """
    pw, browser = await create_stealth_browser(headless=False)

    try:
        context = await create_stealth_context(browser)
        page = await context.new_page()

        # 네이버 로그인 페이지로 이동
        await page.goto(NAVER_LOGIN_URL, wait_until="networkidle")

        import sys as _sys
        print("=" * 50, file=_sys.stderr)
        print("브라우저에서 네이버 로그인을 완료해 주세요.", file=_sys.stderr)
        print("로그인 후 자동으로 쿠키가 저장됩니다.", file=_sys.stderr)
        print("=" * 50, file=_sys.stderr)

        # 로그인 완료 대기 (마이페이지 또는 메인 페이지로 이동 감지)
        try:
            await page.wait_for_url(
                lambda url: "my.naver.com" in url
                or ("naver.com" in url and "nidlogin" not in url),
                timeout=300000,  # 5분 대기
            )
        except Exception:
            return {
                "success": False,
                "message": "로그인 시간이 초과되었습니다 (5분).",
                "cookies_path": None,
            }

        # 로그인 확인 대기
        await page.wait_for_timeout(3000)

        # 쿠키 저장
        cookies_path = await save_cookies(context, account_id)

        return {
            "success": True,
            "message": f"로그인 성공. 쿠키가 저장되었습니다: {cookies_path}",
            "cookies_path": str(cookies_path),
        }

    finally:
        await browser.close()
        await pw.stop()


async def check_session(account_id: str) -> dict:
    """저장된 쿠키로 세션이 유효한지 확인한다.

    Returns:
        {"valid": bool, "message": str}
    """
    cookies = load_cookies(account_id)
    if not cookies:
        return {
            "valid": False,
            "message": f"계정 '{account_id}'의 저장된 쿠키가 없습니다.",
        }

    pw, browser = await create_stealth_browser(headless=True)

    try:
        context = await create_stealth_context(browser, account_id)
        page = await context.new_page()

        # 네이버 마이페이지로 이동하여 로그인 상태 확인
        await page.goto(NAVER_MYPAGE_URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        current_url = page.url

        # 로그인 페이지로 리다이렉트되면 세션 만료
        if "nidlogin" in current_url:
            return {
                "valid": False,
                "message": "세션이 만료되었습니다. 재로그인이 필요합니다.",
            }

        return {
            "valid": True,
            "message": "세션이 유효합니다.",
        }

    finally:
        await browser.close()
        await pw.stop()


def main():
    parser = argparse.ArgumentParser(description="네이버 로그인 및 세션 관리")
    parser.add_argument(
        "--account-id",
        required=True,
        help="계정 식별자 (쿠키 저장 폴더명)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="세션 유효성만 확인",
    )
    args = parser.parse_args()

    if args.check:
        result = asyncio.run(check_session(args.account_id))
    else:
        result = asyncio.run(manual_login(args.account_id))

    print(json.dumps(result, ensure_ascii=True, indent=2))

    if args.check:
        sys.exit(0 if result["valid"] else 1)
    else:
        sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
