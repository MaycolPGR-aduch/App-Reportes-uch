from app.core.security import hash_password, password_needs_rehash, verify_password


def test_hash_and_verify_password() -> None:
    secret = "CampusReportes2026!"
    digest = hash_password(secret)
    assert digest.startswith("$argon2id$")
    assert verify_password(secret, digest)
    assert not verify_password("bad-password", digest)
    assert not password_needs_rehash(digest)
