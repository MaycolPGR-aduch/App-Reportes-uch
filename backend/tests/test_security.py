from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_and_verify_password() -> None:
    secret = "CampusReportes2026!"
    digest = hash_password(secret)
    assert verify_password(secret, digest)
    assert not verify_password("bad-password", digest)


def test_create_and_decode_token_roundtrip() -> None:
    from uuid import uuid4

    token = create_access_token(
        user_id=uuid4(),
        campus_id="u20261234",
        role="STUDENT",
    )
    payload = decode_access_token(token)
    assert payload["campus_id"] == "u20261234"
    assert payload["role"] == "STUDENT"

