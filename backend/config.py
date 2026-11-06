"""Environment configuration shared by the API server and the voice agent worker.

Values are read from the repository's `.env.local` (shared with the Next.js app),
then `backend/.env`. Real environment variables always take precedence.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
REPO_DIR = BACKEND_DIR.parent

for env_file in (REPO_DIR / ".env.local", REPO_DIR / ".env", BACKEND_DIR / ".env"):
    if env_file.exists():
        load_dotenv(env_file, override=False)

AGENT_NAME = "niyamic-voice-agent"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    # Azure OpenAI v1 / OpenAI-compatible endpoint (base URL + model)...
    openai_api_key: str
    openai_base_url: str
    openai_model: str
    # ...or classic Azure OpenAI (endpoint + deployment + API version).
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str
    azure_openai_api_version: str
    llm_temperature: float | None
    deepgram_api_key: str
    deepgram_model: str
    deepgram_language: str
    smallest_api_key: str
    smallest_model: str
    smallest_voice_id: str
    smallest_language: str
    data_dir: Path
    max_upload_mb: int
    cors_origins: list[str]

    @property
    def livekit_ready(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)

    @property
    def uses_openai_v1(self) -> bool:
        return bool(self.openai_base_url and self.openai_api_key and self.openai_model)

    @property
    def azure_openai_ready(self) -> bool:
        return self.uses_openai_v1 or bool(
            self.azure_openai_endpoint and self.azure_openai_api_key and self.azure_openai_deployment
        )

    @property
    def llm_model(self) -> str:
        return self.openai_model if self.uses_openai_v1 else self.azure_openai_deployment

    @property
    def deepgram_ready(self) -> bool:
        return bool(self.deepgram_api_key)

    @property
    def smallest_ready(self) -> bool:
        return bool(self.smallest_api_key)

    @property
    def voice_ready(self) -> bool:
        return (
            self.livekit_ready and self.azure_openai_ready and self.deepgram_ready and self.smallest_ready
        )


def _optional_float(name: str, default: str) -> float | None:
    value = _env(name, default).lower()
    return None if value in ("", "none", "default") else float(value)


def load_settings() -> Settings:
    data_dir = Path(_env("DATA_DIR") or BACKEND_DIR / "storage")
    return Settings(
        livekit_url=_env("LIVEKIT_URL"),
        livekit_api_key=_env("LIVEKIT_API_KEY"),
        livekit_api_secret=_env("LIVEKIT_API_SECRET"),
        openai_api_key=_env("OPENAI_API_KEY"),
        openai_base_url=_env("OPENAI_BASE_URL"),
        openai_model=_env("OPENAI_MODEL"),
        azure_openai_endpoint=_env("AZURE_OPENAI_ENDPOINT"),
        azure_openai_api_key=_env("AZURE_OPENAI_API_KEY"),
        azure_openai_deployment=_env("AZURE_OPENAI_DEPLOYMENT"),
        azure_openai_api_version=_env("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        llm_temperature=_optional_float("LLM_TEMPERATURE", "0.3"),
        deepgram_api_key=_env("DEEPGRAM_API_KEY"),
        deepgram_model=_env("DEEPGRAM_MODEL", "nova-3"),
        deepgram_language=_env("DEEPGRAM_LANGUAGE", "en-IN"),
        smallest_api_key=_env("SMALLEST_API_KEY"),
        smallest_model=_env("SMALLEST_MODEL", "lightning_v3.1_pro"),
        smallest_voice_id=_env("SMALLEST_VOICE_ID"),
        smallest_language=_env("SMALLEST_LANGUAGE", "en"),
        data_dir=data_dir,
        max_upload_mb=int(_env("MAX_UPLOAD_MB", "25") or 25),
        cors_origins=[origin.strip() for origin in _env("CORS_ORIGINS").split(",") if origin.strip()],
    )


settings = load_settings()
