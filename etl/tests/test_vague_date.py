"""VagueDate parser tests. Real strings from GCAT release 1.8.9."""

from datetime import datetime, timezone

from etl import vague_date


def dt(year, month, day, hour=0, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


def test_year_precision():
    value = vague_date.parse("1969")
    assert value.raw == "1969"
    assert value.best == dt(1969, 1, 1)
    assert value.precision == "year"
    assert value.approx is False


def test_month_precision():
    value = vague_date.parse("1969 Jul")
    assert value.best == dt(1969, 7, 1)
    assert value.precision == "month"


def test_day_precision_and_padding():
    value = vague_date.parse("1957 Oct  4")
    assert value.best == dt(1957, 10, 4)
    assert value.precision == "day"


def test_minute_precision():
    value = vague_date.parse("1969 Jul 20 2017")
    assert value.best == dt(1969, 7, 20, 20, 17)
    assert value.precision == "minute"


def test_second_precision():
    value = vague_date.parse("1969 Jul 20 2017:33")
    assert value.best == dt(1969, 7, 20, 20, 17, 33)
    assert value.precision == "second"


def test_approximate_marker_is_preserved():
    value = vague_date.parse("1957 Dec  1 1000?")
    assert value.raw == "1957 Dec  1 1000?"
    assert value.approx is True
    assert value.best == dt(1957, 12, 1, 10, 0)


def test_null_values():
    for raw in ("", "-", "*"):
        value = vague_date.parse(raw)
        assert value.best is None
        assert value.precision == "unknown"
        assert value.approx is False


def test_decade_is_unknown_but_orderable():
    value = vague_date.parse("1970s?")
    assert value.raw == "1970s?"
    assert value.best == dt(1970, 1, 1)
    assert value.precision == "unknown"
    assert value.approx is True


def test_quarter_is_unknown_but_orderable():
    value = vague_date.parse("2010 Q3")
    assert value.best == dt(2010, 7, 1)
    assert value.precision == "unknown"


def test_invalid_date_keeps_raw_and_reports_unknown():
    value = vague_date.parse("1969 Feb 30")
    assert value.raw == "1969 Feb 30"
    assert value.best is None
    assert value.precision == "unknown"


def test_never_raises_on_garbage():
    value = vague_date.parse("not a date")
    assert value.raw == "not a date"
    assert value.best is None
    assert value.precision == "unknown"


def test_display_does_not_invent_precision():
    assert vague_date.format_for_display(vague_date.parse("1969")) == "1969"
    assert vague_date.format_for_display(vague_date.parse("1969 Jul")) == "July 1969"
    assert vague_date.format_for_display(vague_date.parse("1970s?")) == "1970s?"
