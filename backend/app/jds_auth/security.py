import hashlib
import hmac
import secrets


def create_secret() -> str:
    return secrets.token_urlsafe(48)


def hash_secret(secret: str, pepper: str) -> str:
    return hmac.new(pepper.encode(), secret.encode(), hashlib.sha256).hexdigest()


def secret_matches(secret: str, expected_hash: str, pepper: str) -> bool:
    return hmac.compare_digest(hash_secret(secret, pepper), expected_hash)
