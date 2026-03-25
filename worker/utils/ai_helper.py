"""AI 콘텐츠 생성 헬퍼 — OpenAI / Claude / Gemini 지원."""

import json
import urllib.request
import urllib.error


def call_openai(api_key: str, model: str, prompt: str, content: str) -> str:
    """OpenAI API를 호출하여 콘텐츠를 변환한다."""
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": content},
        ],
        "max_tokens": 4096,
        "temperature": 0.7,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]


def call_claude(api_key: str, model: str, prompt: str, content: str) -> str:
    """Claude API를 호출하여 콘텐츠를 변환한다."""
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model,
        "max_tokens": 4096,
        "system": prompt,
        "messages": [
            {"role": "user", "content": content},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["content"][0]["text"]


def call_gemini(api_key: str, model: str, prompt: str, content: str) -> str:
    """Gemini API를 호출하여 콘텐츠를 변환한다."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{prompt}\n\n{content}"},
                ],
            },
        ],
    }
    headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result["candidates"][0]["content"]["parts"][0]["text"]


def generate_ai_content(
    api_keys: dict,
    model: str,
    prompt: str,
    content: str,
) -> str:
    """등록된 API 키와 모델에 따라 적절한 AI 서비스를 호출한다.

    Returns:
        AI가 생성한 콘텐츠. 실패 시 원본 콘텐츠를 반환한다.
    """
    try:
        if model.startswith("gpt") and api_keys.get("openai"):
            return call_openai(api_keys["openai"], model, prompt, content)
        elif model.startswith("claude") and api_keys.get("claude"):
            return call_claude(api_keys["claude"], model, prompt, content)
        elif model.startswith("gemini") and api_keys.get("gemini"):
            return call_gemini(api_keys["gemini"], model, prompt, content)
        else:
            return content  # 키 없으면 원본 반환
    except Exception as e:
        import sys
        print(f"[AI] API 호출 실패: {e}", file=sys.stderr)
        return content  # 실패 시 원본 반환
