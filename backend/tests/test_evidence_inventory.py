from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.evidence_inventory import compare_inventory, inventory
from app.services.storage import LocalStorageProvider, S3StorageProvider


class FakeDB:
    def __init__(self, rows=(), pending=()):
        self.rows, self.pending = rows, pending

    def execute(self, _query):
        return SimpleNamespace(all=lambda: self.rows)

    def scalars(self, _query):
        return SimpleNamespace(all=lambda: self.pending)


def test_comparison_excludes_pending_deletions():
    result = compare_inventory({"ref", "missing"}, {"queued"}, {"ref", "queued", "orphan"})
    assert result.orphan_candidates == ("orphan",)
    assert result.missing_candidates == ("missing",)


def test_local_grace_and_pending(tmp_path):
    import os
    provider = LocalStorageProvider(tmp_path / "evidences")
    old = datetime.now(timezone.utc) - timedelta(days=2)
    for name in ("orphan", "queued", "recent"):
        path = provider.base_dir / name
        path.write_text(name)
        if name != "recent":
            os.utime(path, (old.timestamp(), old.timestamp()))
    db = FakeDB([("evidences/missing", old), ("evidences/new", datetime.now(timezone.utc))],
                ["evidences/queued"])
    result = inventory(db, provider)
    assert result.orphan_candidates == ("evidences/orphan",)
    assert result.missing_candidates == ("evidences/missing",)


def test_s3_pagination_and_prefix(monkeypatch):
    now = datetime.now(timezone.utc)
    class Paginator:
        def paginate(self, **kwargs):
            assert kwargs == {"Bucket": "bucket", "Prefix": "evidences/"}
            return [{"Contents": [{"Key": "evidences/old", "LastModified": now - timedelta(days=2)}]},
                    {"Contents": [{"Key": "evidences/new", "LastModified": now}]}]
    class Client:
        def get_paginator(self, name):
            assert name == "list_objects_v2"
            return Paginator()
    monkeypatch.setattr("boto3.client", lambda *a, **kw: Client())
    provider = S3StorageProvider(bucket="bucket")
    assert inventory(FakeDB(), provider).orphan_candidates == ("evidences/old",)
    with pytest.raises(ValueError):
        inventory(FakeDB(), provider, grace_hours=0)
