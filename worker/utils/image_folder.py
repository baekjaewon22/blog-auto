"""이미지 폴더에서 랜덤 이미지를 선택하는 헬퍼."""

import os
import random
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


def get_random_image(folder_path: str) -> str | None:
    """폴더에서 랜덤으로 이미지 1개를 선택한다.

    Returns:
        이미지 파일 경로. 폴더가 없거나 이미지가 없으면 None.
    """
    folder = Path(folder_path)
    if not folder.exists() or not folder.is_dir():
        return None

    images = [
        str(f) for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    ]

    if not images:
        return None

    return random.choice(images)


def get_all_images(folder_path: str) -> list[str]:
    """폴더의 모든 이미지 경로를 반환한다."""
    folder = Path(folder_path)
    if not folder.exists() or not folder.is_dir():
        return []

    return sorted(
        str(f) for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    )
