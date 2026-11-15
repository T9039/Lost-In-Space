from __future__ import annotations

from etl import celestrak_refresh


class Response:
    def __init__(self, payload: bytes, status_code: int = 200):
        self.content = payload
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self):
        import json

        return json.loads(self._payload)


class Session:
    def __init__(self):
        self.calls: list[dict] = []

    def get(self, url, params, timeout):
        self.calls.append(params)
        satcat = params["CATNR"]
        if satcat == "5":
            return Response(b"No GP data found")
        if satcat == "2756":
            return Response(b"", status_code=404)
        return Response(
            (
                '{"OBJECT_NAME":"OBJECT %s","NORAD_CAT_ID":%s,'
                '"EPOCH":"2026-01-01T00:00:00","MEAN_MOTION":15.5,'
                '"ECCENTRICITY":0.001,"INCLINATION":51.6,'
                '"RA_OF_ASC_NODE":10,"ARG_OF_PERICENTER":20,'
                '"MEAN_ANOMALY":30}'
            ).encode()
            % (satcat.encode(), satcat.encode())
        )


def test_fetch_batch_queries_each_catnr(monkeypatch):
    session = Session()
    monkeypatch.setattr(celestrak_refresh.time, "sleep", lambda _: None)

    records = celestrak_refresh.fetch_batch(session, [6633, 5, 2756, 10321])

    assert [call["CATNR"] for call in session.calls] == ["6633", "5", "2756", "10321"]
    assert [record["NORAD_CAT_ID"] for record in records] == [6633, 10321]


class Cursor:
    rowcount = 3

    def execute(self, sql, params):
        self.sql = sql
        self.params = params


def test_prune_uses_the_curated_allowlist():
    cur = Cursor()
    removed = celestrak_refresh.prune(cur, [5, 6633])

    assert removed == 3
    assert "interval '30 days'" in cur.sql
    assert cur.params == ([5, 6633],)
