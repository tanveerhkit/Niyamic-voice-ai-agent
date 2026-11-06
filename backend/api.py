"""HTTP API for the Niyamic Echo frontend.

Serves dataset uploads and retrieval tests, reports which voice providers are
configured, and issues LiveKit tokens that dispatch the voice agent into a call.
All provider secrets stay on this server.
"""

from __future__ import annotations

import json
import secrets
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
import jwt
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from livekit import api as livekit_api
from pydantic import BaseModel, Field

import knowledge
from config import AGENT_NAME, settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    knowledge.init_storage()
    yield


app = FastAPI(title="Niyamic Echo API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Status                                                                      #
# --------------------------------------------------------------------------- #

_clock_offset: tuple[float, float] | None = None  # (seconds, measured at)


def livekit_clock_offset() -> float:
    """Seconds to add to this machine's clock to match LiveKit's, cached for ten minutes.

    LiveKit rejects tokens whose validity window does not cover its own time, so a
    machine with a wrong clock would otherwise issue tokens that fail as "invalid".
    """
    global _clock_offset
    if _clock_offset and time.time() - _clock_offset[1] < 600:
        return _clock_offset[0]
    offset = 0.0
    if settings.livekit_url:
        try:
            url = settings.livekit_url.replace("wss://", "https://").replace("ws://", "http://")
            response = httpx.head(url, timeout=3, follow_redirects=True)
            offset = parsedate_to_datetime(response.headers["date"]).timestamp() - time.time()
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            offset = 0.0
    _clock_offset = (offset, time.time())
    return offset


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "clockSkewSeconds": round(livekit_clock_offset()) if settings.livekit_ready else 0,
        "voice": {
            "ready": settings.voice_ready,
            "providers": {
                "livekit": {
                    "configured": settings.livekit_ready,
                    "detail": urlparse(settings.livekit_url).hostname or None,
                },
                "azureOpenAI": {
                    "configured": settings.azure_openai_ready,
                    "detail": settings.llm_model or None,
                },
                "deepgram": {
                    "configured": settings.deepgram_ready,
                    "detail": f"{settings.deepgram_model} · {settings.deepgram_language}",
                },
                "smallestAI": {
                    "configured": settings.smallest_ready,
                    "detail": settings.smallest_model,
                },
            },
        },
        "data": knowledge.stats(),
    }


# --------------------------------------------------------------------------- #
# Datasets                                                                    #
# --------------------------------------------------------------------------- #


async def _save_upload(upload: UploadFile) -> tuple[Path, int]:
    if not upload.filename:
        raise HTTPException(400, "The upload has no file name.")
    try:
        knowledge.kind_for(upload.filename)
    except knowledge.DatasetError as exc:
        raise HTTPException(415, str(exc)) from exc

    limit = settings.max_upload_mb * 1024 * 1024
    temp_path = knowledge.UPLOAD_DIR / f".upload-{uuid.uuid4().hex}"
    size = 0
    try:
        with temp_path.open("wb") as out:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"Files must be {settings.max_upload_mb} MB or smaller.")
                out.write(chunk)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise
    if size == 0:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(400, "The file is empty.")
    return temp_path, size


def _get_or_404(dataset_id: str) -> dict[str, Any]:
    try:
        return knowledge.get_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(404, "Dataset not found.") from exc


@app.get("/api/datasets")
def list_datasets() -> dict[str, Any]:
    return {"datasets": knowledge.list_datasets(), "stats": knowledge.stats()}


@app.post("/api/datasets", status_code=202)
async def upload_dataset(background: BackgroundTasks, file: UploadFile = File(...)) -> dict[str, Any]:
    temp_path, size = await _save_upload(file)
    dataset = knowledge.create_dataset(file.filename or "upload", size)
    shutil.move(temp_path, knowledge.file_path(dataset["id"], dataset["filename"]))
    background.add_task(knowledge.process_dataset, dataset["id"])
    return dataset


@app.put("/api/datasets/{dataset_id}", status_code=202)
async def replace_dataset(
    dataset_id: str, background: BackgroundTasks, file: UploadFile = File(...)
) -> dict[str, Any]:
    _get_or_404(dataset_id)
    temp_path, size = await _save_upload(file)
    dataset = knowledge.begin_replace(dataset_id, file.filename or "upload", size)
    shutil.move(temp_path, knowledge.file_path(dataset_id, dataset["filename"]))
    background.add_task(knowledge.process_dataset, dataset_id)
    return dataset


@app.delete("/api/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str) -> Response:
    _get_or_404(dataset_id)
    knowledge.delete_dataset(dataset_id)
    return Response(status_code=204)


@app.get("/api/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: str, limit: int = Query(25, ge=1, le=200)) -> dict[str, Any]:
    _get_or_404(dataset_id)
    return knowledge.preview_dataset(dataset_id, limit)


@app.get("/api/search")
def search(q: str = Query(..., min_length=1, max_length=200)) -> dict[str, Any]:
    """Run the same retrieval the voice agent uses, for testing uploaded data."""
    return {
        "query": q,
        "records": knowledge.lookup_records(q),
        "documents": knowledge.search_documents(q),
    }


# --------------------------------------------------------------------------- #
# Voice calls                                                                 #
# --------------------------------------------------------------------------- #


class AgentProfile(BaseModel):
    id: str = Field("", max_length=80)
    name: str = Field("Ayesha", max_length=80)
    role: str = Field("", max_length=160)
    persona: str = Field("", max_length=2000)
    tone: str = Field("", max_length=60)
    greeting: str = Field("", max_length=600)
    systemPrompt: str = Field("", max_length=6000)
    knowledge: str = Field("", max_length=12000)
    languages: list[str] = Field(default_factory=list, max_length=10)


class TokenRequest(BaseModel):
    agent: AgentProfile = Field(default_factory=AgentProfile)
    participantName: str = Field("Customer", max_length=80)


@app.post("/api/token")
def create_token(request: TokenRequest) -> dict[str, Any]:
    missing = [
        name
        for name, ready in (
            ("LiveKit", settings.livekit_ready),
            ("Azure OpenAI", settings.azure_openai_ready),
            ("Deepgram", settings.deepgram_ready),
            ("Smallest AI", settings.smallest_ready),
        )
        if not ready
    ]
    if missing:
        raise HTTPException(503, f"Voice calling is not configured. Missing: {', '.join(missing)}.")

    room_name = f"call-{uuid.uuid4().hex[:12]}"
    identity = f"customer-{secrets.token_hex(4)}"
    dispatch = livekit_api.RoomAgentDispatch(
        agent_name=AGENT_NAME,
        metadata=json.dumps(request.agent.model_dump(), ensure_ascii=False),
    )
    token = (
        livekit_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(request.participantName)
        .with_ttl(timedelta(minutes=30))
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_room_config(livekit_api.RoomConfiguration(agents=[dispatch]))
        .to_jwt()
    )
    # Re-stamp the validity window on LiveKit's clock, with a little leeway.
    claims = jwt.decode(token, options={"verify_signature": False})
    offset = round(livekit_clock_offset())
    claims["nbf"] += offset - 30
    claims["exp"] += offset
    return {
        "serverUrl": settings.livekit_url,
        "participantToken": jwt.encode(claims, settings.livekit_api_secret, algorithm="HS256"),
        "roomName": room_name,
        "participantIdentity": identity,
    }
