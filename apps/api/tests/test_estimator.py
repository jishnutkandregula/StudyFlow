"""Tests for the time estimator: rules, calibration, and the /estimates route."""

from __future__ import annotations

import pytest

from app.estimator import (
    EstimateRequestItem,
    EstimateSample,
    calibrate,
    classify,
    estimate,
    plain_text,
)


def _est(
    title: str,
    description: str | None = None,
    points: float | None = None,
    course: str = "CSE 101",
    history=None,
):
    return estimate(
        EstimateRequestItem(
            id="x", title=title, course=course, description=description, points=points
        ),
        history,
    )


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "category"),
    [
        ("Reading Quiz 4", "quiz"),
        ("Lab report 3", "lab"),
        ("Final Project: milestone 2", "project"),
        ("Midterm 1", "exam"),
        ("Discussion: Week 8", "discussion"),
        ("Argumentative essay", "essay"),
        ("HW 5", "problem_set"),
        ("Problem Set 2", "problem_set"),
        ("Read chapters 3-4", "reading"),
        ("Reading response 2", "reflection"),
        ("Group presentation", "presentation"),
        ("Programming Assignment 3", "programming"),
        ("Untitled", "other"),
    ],
)
def test_classify_from_title(title: str, category: str) -> None:
    assert classify(title) == category


def test_title_wins_over_description() -> None:
    assert classify("Quiz 3", "Read the chapter, then answer the questions") == "quiz"
    assert classify("Week 4", "Write a two-page essay on ...") == "essay"


def test_plain_text_strips_canvas_html() -> None:
    assert (
        plain_text("<p>Write <b>1,500&nbsp;words</b></p>\n<ul><li>cite</li></ul>")
        == "Write 1,500 words cite"
    )


# ---------------------------------------------------------------------------
# Rules: stated amounts beat typical lengths
# ---------------------------------------------------------------------------


def test_word_count_drives_writing_estimates() -> None:
    short, long = _est("Essay 1", "Write 500 words"), _est("Essay 2", "<p>1,200-1,500 words</p>")
    assert long.confidence == "high" and "1,500 words" in long.reason
    assert long.minutes > short.minutes
    assert 240 <= long.minutes <= 360  # a 1,500-word essay is an afternoon, not an hour


@pytest.mark.parametrize(
    "text",
    ["Write a 1,500-word essay", "1500 words", "1,000-1,500 words", "1,500+ words"],
)
def test_word_count_phrasings(text: str) -> None:
    assert "1,500 words" in _est("Essay", text).reason


def test_hyphenated_pages_and_slides() -> None:
    assert "5 pages of writing" in _est("Paper", "a 5-page paper").reason
    assert "8 slides" in _est("Presentation", "an 8-slide deck").reason


def test_pages_of_writing_and_pages_of_reading_differ() -> None:
    writing = _est("Reading response", "2 pages double-spaced")
    reading = _est("Read pp. 45-80")
    assert writing.category == "reflection" and "2 pages of writing" in writing.reason
    assert reading.category == "reading" and "36 pages of reading" in reading.reason


def test_problem_counts_and_spans() -> None:
    assert "12 problems" in _est("Problem Set 5", "Complete problems 1-12").reason
    assert "8 problems" in _est("Homework 3", "There are 8 problems this week").reason
    more = _est("Homework 4", "problems 1-20")
    fewer = _est("Homework 5", "problems 1-5")
    assert more.minutes > fewer.minutes


def test_quiz_time_limit() -> None:
    result = _est("Quiz 3", "This quiz has a time limit: 20 minutes.")
    assert result.confidence == "high" and "20-minute time limit" in result.reason
    assert result.minutes <= 60


def test_chapters_and_slides() -> None:
    assert "2 chapters" in _est("Read Chapters 3-4").reason
    assert "1 chapter" in _est("Read chapter 7").reason
    assert "10 slides" in _est("Group presentation", "Prepare 10 slides").reason


def test_typical_length_when_nothing_is_stated() -> None:
    lab = _est("Lab 6: Shortest paths")
    assert lab.confidence == "medium" and lab.reason == "Lab · typical lab"
    unknown = _est("Untitled thing")
    assert unknown.confidence == "low" and unknown.minutes == 60


def test_points_nudge_but_do_not_dominate() -> None:
    small = _est("Project", points=10)
    large = _est("Project", points=1000)
    assert large.minutes > small.minutes
    assert large.minutes <= 2 * 360  # capped influence


def test_estimates_are_rounded_and_bounded() -> None:
    huge = _est("Essay", "19,000 words")
    assert huge.minutes == 720
    for result in (_est("Reading", "2 pages of reading"), huge, _est("Lab 1")):
        assert result.minutes % 15 == 0 and 15 <= result.minutes <= 720


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------


def _samples(n: int, ratio: float, category: str = "lab", course: str = "CSE 101"):
    return [
        EstimateSample(
            category=category, course=course, estimated_minutes=100, actual_minutes=int(100 * ratio)
        )
        for _ in range(n)
    ]


def test_no_history_means_no_change() -> None:
    assert calibrate("lab", "CSE 101", []).multiplier == 1.0
    result = _est("Lab 7")
    assert result.multiplier == 1.0 and result.minutes == result.base_minutes


def test_consistent_overruns_raise_estimates_gradually() -> None:
    one = calibrate("lab", "CSE 101", _samples(1, 1.5)).multiplier
    five = calibrate("lab", "CSE 101", _samples(5, 1.5)).multiplier
    twenty = calibrate("lab", "CSE 101", _samples(20, 1.5)).multiplier
    assert 1.0 < one < five < twenty <= 1.5  # shrinkage: evidence moves it toward 1.5x


def test_finishing_early_lowers_estimates() -> None:
    assert calibrate("lab", "CSE 101", _samples(6, 0.6)).multiplier < 0.85


def test_calibration_is_specific_to_course_and_kind() -> None:
    history = _samples(6, 1.8, course="CSE 101") + _samples(6, 1.0, course="BIO 20L")
    cse = calibrate("lab", "CSE 101", history).multiplier
    bio = calibrate("lab", "BIO 20L", history).multiplier
    assert cse > bio
    # Other kinds of work move only a little, through the shared overall pace.
    assert calibrate("essay", "WRIT 2", history).multiplier < cse


def test_one_outlier_cannot_swing_everything() -> None:
    history = _samples(1, 4.0) + _samples(6, 1.0)
    assert calibrate("lab", "CSE 101", history).multiplier < 1.3


def test_calibrated_reason_explains_the_adjustment() -> None:
    result = _est("Lab 7", history=_samples(4, 1.5))
    assert result.minutes > result.base_minutes
    assert "for your pace on CSE 101 labs (4 finished)" in result.reason


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


def test_estimates_route_uses_saved_history(session_client) -> None:
    items = {"items": [{"id": "a", "title": "Lab 7", "course": "CSE 101"}]}
    before = session_client.post("/api/v1/estimates", json=items).json()
    assert before["calibrated_from"] == 0
    assert before["estimates"][0]["reason"] == "Lab · typical lab"

    workspace = {
        "tasks": [],
        "estimate_history": [
            {
                "category": "lab",
                "course": "CSE 101",
                "estimated_minutes": 120,
                "actual_minutes": 200,
            }
        ]
        * 4,
    }
    assert session_client.put("/api/v1/workspace", json=workspace).status_code == 200
    after = session_client.post("/api/v1/estimates", json=items).json()
    assert after["calibrated_from"] == 4
    assert after["estimates"][0]["minutes"] > before["estimates"][0]["minutes"]


def test_estimates_route_requires_session_header() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    client.get("/api/v1/workspace")
    assert client.post("/api/v1/estimates", json={"items": []}).status_code == 403
