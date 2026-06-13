import io
import logging

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FinTracker OCR Service", version="1.0.0")

# Lazy singleton — initialised on first request so the container starts
# even before models are downloaded. Models persist in /root/.paddleocr volume.
_ocr: PaddleOCR | None = None


def _get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        logger.info("Initialising PaddleOCR (models may download on first run)...")
        _ocr = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)
        logger.info("PaddleOCR ready")
    return _ocr

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract")
async def extract(file: UploadFile = File(...)):
    """
    Accept a payment slip image and return extracted text with confidence score.
    Expects multipart/form-data with a field named 'file'.
    """
    contents = await file.read()

    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    content_type = file.content_type or ""
    if not content_type.startswith("image/") and not _is_image_bytes(contents[:16]):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {exc}") from exc

    img_array = np.array(img)

    try:
        result = _get_ocr().ocr(img_array, cls=True)
    except Exception as exc:
        logger.error("PaddleOCR error: %s", exc)
        raise HTTPException(status_code=500, detail="OCR processing failed") from exc

    lines: list[str] = []
    confidences: list[float] = []

    if result and result[0]:
        for line in result[0]:
            text, conf = line[1][0], float(line[1][1])
            lines.append(text)
            confidences.append(conf)

    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    full_text = "\n".join(lines)

    logger.info(
        "OCR done: %d lines, avg confidence %.2f, file=%s",
        len(lines),
        avg_confidence,
        file.filename,
    )

    return {"text": full_text, "confidence": round(avg_confidence, 4)}


# ── helpers ───────────────────────────────────────────────────────────────────

_IMAGE_MAGIC = [
    b"\xff\xd8\xff",        # JPEG
    b"\x89PNG",             # PNG
    b"RIFF",                # WebP
    b"GIF8",                # GIF
]


def _is_image_bytes(header: bytes) -> bool:
    return any(header.startswith(magic) for magic in _IMAGE_MAGIC)
