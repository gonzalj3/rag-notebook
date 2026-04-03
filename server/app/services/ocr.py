import io

import pytesseract
from PIL import Image, ImageFilter


def extract_text(image_bytes: bytes) -> str:
    """Extract text from an image using Tesseract OCR with preprocessing."""
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to grayscale
    if image.mode != "L":
        image = image.convert("L")

    # Light sharpening to improve OCR on handwritten text
    image = image.filter(ImageFilter.SHARPEN)

    # Binarize with a threshold for cleaner text
    threshold = 128
    image = image.point(lambda p: 255 if p > threshold else 0)

    text = pytesseract.image_to_string(image, lang="eng")
    return text.strip()
