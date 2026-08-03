"""Recipe photo storage.

Photos live in a private S3 bucket, never in DynamoDB. The recipe item stores
only the object key; browsers get a short-lived presigned URL that the service
mints on read, so the bucket itself stays closed to the world.

Uploads go straight from the browser to S3 via a presigned POST, which keeps
image bytes out of the Lambda (and out of API Gateway's 10 MB payload cap).
The POST policy -- not the client -- enforces the type and size limits.
"""

import os
import re
import uuid

import boto3
from botocore.config import Config

BUCKET = os.environ.get("RECIPE_PHOTO_BUCKET", "")

# The browser downscales before uploading; this is the backstop for anyone
# calling the presigned POST directly.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
UPLOAD_TTL = 900  # 15 min to finish an upload
VIEW_TTL = 3600  # 1 h; keep under the Lambda credential lifetime

# SigV4 is required for presigned POST/GET to work in every region.
_s3 = boto3.client("s3", config=Config(signature_version="s3v4"))


def _prefix(owner_id: str) -> str:
    return f"recipes/{owner_id}/"


# Exactly the shape presigned_upload mints: a uuid4 plus a known extension.
_FILENAME = re.compile(r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$")


def owns_key(owner_id: str, key: str) -> bool:
    """Whether `key` is one this user could legitimately have been given.

    Recipes carry a client-supplied `image_key`, so without this check a user
    could point their recipe at another user's object and read it through the
    presigned URL the service hands back.

    A prefix test alone is not enough: `recipes/<me>/../<victim>/photo.jpg`
    starts with the right prefix, and while S3 treats keys as opaque, the
    presigned URL is an HTTP path that clients and proxies may normalise before
    it is sent -- resolving the `..` onto someone else's object. Matching the
    exact minted filename removes the question entirely.
    """
    if not key or not key.startswith(_prefix(owner_id)):
        return False
    return bool(_FILENAME.match(key[len(_prefix(owner_id)) :]))


def presigned_upload(owner_id: str, content_type: str) -> dict:
    """Mint a one-shot presigned POST for a new photo."""
    ext = EXTENSIONS[content_type]
    key = f"{_prefix(owner_id)}{uuid.uuid4()}.{ext}"
    post = _s3.generate_presigned_post(
        Bucket=BUCKET,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, MAX_UPLOAD_BYTES],
        ],
        ExpiresIn=UPLOAD_TTL,
    )
    return {"image_key": key, "url": post["url"], "fields": post["fields"]}


def view_url(key: str | None) -> str | None:
    """Presigned GET for an object key, or None when there's no photo."""
    if not key or not BUCKET:
        return None
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=VIEW_TTL,
    )


def delete(key: str | None) -> None:
    """Best-effort cleanup; a stray object must never fail the user's request."""
    if not key or not BUCKET:
        return
    try:
        _s3.delete_object(Bucket=BUCKET, Key=key)
    except Exception:
        pass
