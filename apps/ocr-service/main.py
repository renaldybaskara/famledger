import io
import logging

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR
from PIL import Image, ImageEnhance

# Register HEIC/HEIF support if pillow-heif is installed (needed for iOS photos)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    _HEIF_SUPPORT = True
except ImportError:
    _HEIF_SUPPORT = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FinTracker OCR Service", version="1.0.0")

# ── OCR singleton ─────────────────────────────────────────────────────────────
# Lazy init so the container starts before models are downloaded.
# Models persist in the /root/.paddleocr volume.
_ocr: PaddleOCR | None = None


def _get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        logger.info("Initialising PaddleOCR (models may download on first run)...")
        _ocr = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            use_gpu=False,
            show_log=False,
            # ── Detection thresholds ──────────────────────────────────────────
            # Lower det_db_thresh catches faint thermal-print text (default 0.3)
            det_db_thresh=0.2,
            # Lower box_thresh accepts more text-box candidates (default 0.6)
            det_db_box_thresh=0.4,
            # Wider unclip expands bounding boxes — helps tight receipt lines
            det_db_unclip_ratio=1.8,
            # ── Recognition ──────────────────────────────────────────────────
            # Batch size 1 is more stable for CPU inference on long images
            rec_batch_num=1,
        )
        logger.info("PaddleOCR ready")
    return _ocr


MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

# MIME types accepted from the client (iOS sends heic/heif)
ACCEPTED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
    "application/octet-stream",
}

# ── Preprocessing constants ───────────────────────────────────────────────────
# Receipts: tall-and-narrow thermal paper photos
_RECEIPT_ASPECT_RATIO = 2.0   # height/width > this → likely a receipt
_RECEIPT_GRAY_RATIO   = 0.85  # fraction of pixels that are "near-gray" → thermal print

# Upscale targets: ensure text height ≥ 32 px for reliable recognition
_RECEIPT_MIN_WIDTH  = 800   # receipts — upscale if narrower
_STANDARD_MIN_WIDTH = 1200  # general slips/photos


# ── Smart preprocessing ───────────────────────────────────────────────────────

def _is_receipt_image(img_rgb: np.ndarray) -> bool:
    """
    Heuristic: is this image a receipt (tall thermal paper)?
    Checks aspect ratio AND color saturation (thermal receipts are near-grayscale).
    """
    h, w = img_rgb.shape[:2]

    # 1. Aspect ratio check
    if h < _RECEIPT_ASPECT_RATIO * w:
        return False

    # 2. Color saturation check — receipts are black-on-white, very low saturation
    img_hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    saturation = img_hsv[:, :, 1]  # S channel 0-255
    low_sat_ratio = np.mean(saturation < 30)  # fraction of near-gray pixels
    return bool(low_sat_ratio >= _RECEIPT_GRAY_RATIO)


def _preprocess_receipt(img_rgb: np.ndarray) -> np.ndarray:
    """
    Receipt mode (thermal paper, long narrow struk):
    1. Convert to grayscale
    2. Upscale so minimum width = _RECEIPT_MIN_WIDTH
    3. Apply CLAHE (adaptive histogram equalisation) for uneven lighting
    4. Adaptive threshold → clean black-on-white binary image
    5. Return as 3-channel RGB (PaddleOCR expects RGB)
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)

    # Upscale if too narrow — small text needs at least 32px height per line
    h, w = gray.shape
    if w < _RECEIPT_MIN_WIDTH:
        scale = _RECEIPT_MIN_WIDTH / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        logger.debug("Receipt upscaled %.1fx → (%d × %d)", scale, new_w, new_h)

    # CLAHE: adaptive equalisation handles shadows & uneven thermal printing
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # Adaptive threshold: handles gradient lighting across a long receipt
    # Block size 31 = ~1 line of text; C=10 removes noise
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=10,
    )

    # Optional: mild dilation to reconnect broken characters from thermal fade
    kernel = np.ones((1, 1), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # Convert back to 3-channel RGB for PaddleOCR
    return cv2.cvtColor(binary, cv2.COLOR_GRAY2RGB)


def _preprocess_standard(img_rgb: np.ndarray) -> np.ndarray:
    """
    Standard mode (bank transfer slips, e-wallet screenshots, photos):
    1. Upscale mildly if too small
    2. Enhance contrast + sharpness with Pillow (gentler than binarisation)
    3. Return as numpy RGB
    """
    h, w = img_rgb.shape[:2]

    # Convert to Pillow for enhancement
    pil_img = Image.fromarray(img_rgb)

    # Upscale 1.2× if below minimum width
    if w < _STANDARD_MIN_WIDTH:
        scale = _STANDARD_MIN_WIDTH / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        pil_img = pil_img.resize((new_w, new_h), Image.LANCZOS)
        logger.debug("Standard upscaled %.1fx → (%d × %d)", scale, new_w, new_h)

    # Boost contrast — helps faded ink or screenshots with low contrast
    pil_img = ImageEnhance.Contrast(pil_img).enhance(1.5)

    # Mild sharpening — helps blurry phone photos
    pil_img = ImageEnhance.Sharpness(pil_img).enhance(1.8)

    return np.array(pil_img)


def preprocess(img_rgb: np.ndarray) -> tuple[np.ndarray, str]:
    """
    Detect image type and apply appropriate preprocessing.
    Returns (processed_array, mode_name) for logging.
    """
    if _is_receipt_image(img_rgb):
        return _preprocess_receipt(img_rgb), "receipt"
    return _preprocess_standard(img_rgb), "standard"


# ── Health & extract endpoints ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract")
async def extract(file: UploadFile = File(...)):
    """
    Accept a payment slip / receipt image and return extracted text.
    Applies smart preprocessing (receipt vs standard mode) before OCR.
    Supports JPEG, PNG, WebP, and HEIC/HEIF (iOS native format).
    """
    contents = await file.read()

    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    is_heic      = _is_heic_bytes(contents[:12])
    is_image_mime = content_type in ACCEPTED_MIME_TYPES or content_type.startswith("image/")
    is_image_magic = _is_image_bytes(contents[:16])

    if not (is_image_mime or is_image_magic or is_heic):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        if is_heic and not _HEIF_SUPPORT:
            raise HTTPException(
                status_code=415,
                detail="HEIC/HEIF images require pillow-heif. Update the OCR service image."
            ) from exc
        raise HTTPException(status_code=400, detail=f"Cannot open image: {exc}") from exc

    # Raw numpy array (RGB) before any preprocessing
    img_array = np.array(pil_img)

    # Smart preprocessing
    processed_array, mode = preprocess(img_array)

    try:
        result = _get_ocr().ocr(processed_array, cls=True)
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
        "OCR done: mode=%s lines=%d avg_conf=%.2f file=%s",
        mode, len(lines), avg_confidence, file.filename,
    )

    return {"text": full_text, "confidence": round(avg_confidence, 4)}


# ── Helpers ───────────────────────────────────────────────────────────────────

_IMAGE_MAGIC = [
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG",       # PNG
    b"RIFF",          # WebP
    b"GIF8",          # GIF
]

_HEIC_BRANDS = {b"heic", b"heis", b"hevx", b"heim", b"hevc", b"hevs", b"mif1", b"msf1"}


def _is_image_bytes(header: bytes) -> bool:
    return any(header.startswith(magic) for magic in _IMAGE_MAGIC)


def _is_heic_bytes(header: bytes) -> bool:
    """Detect HEIC/HEIF via ISO Base Media File Format ftyp box at offset 4."""
    if len(header) < 12:
        return False
    if header[4:8] != b"ftyp":
        return False
    return header[8:12] in _HEIC_BRANDS
