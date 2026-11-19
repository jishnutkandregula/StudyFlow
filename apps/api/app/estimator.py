"""Time estimates for coursework: explainable rules, then calibration to the student.

Two stages, both deterministic and testable:

1. **Rules.** Read the assignment's title and description, decide what kind of work
   it is (essay, problem set, reading, lab, ...), and look for the amount of work it
   asks for ("1,500 words", "problems 1-12", "chapters 3-4", "a 30-minute time limit").
   Amount beats kind: a stated word count says more than the word "essay". When
   nothing specific is found, the kind's typical length is used, nudged by points.

2. **Calibration.** Every finished task leaves a sample: the estimate it started
   with and the time the student actually logged. The ratio between the two, per
   kind of work and per course, becomes a multiplier on new estimates. Ratios are
   averaged in log space (so 2x over and 2x under cancel) and shrunk toward "no
   change" until there is enough evidence, so one odd week doesn't swing every
   estimate.

Every estimate comes with a short, human reason, because a student should be able
to see why StudyFlow thinks something takes 3 hours, and overrule it.
"""

from __future__ import annotations

import html
import math
import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal[
    "exam",
    "quiz",
    "discussion",
    "presentation",
    "lab",
    "programming",
    "project",
    "essay",
    "problem_set",
    "reading",
    "reflection",
    "other",
]
Confidence = Literal["high", "medium", "low"]

MIN_MINUTES = 15
MAX_MINUTES = 720

# Typical focused time for a college assignment of each kind, and the point value
# that typical length corresponds to (used only when no amount is stated).
_TYPICAL: dict[str, tuple[int, float]] = {
    "exam": (240, 100),
    "quiz": (40, 10),
    "discussion": (35, 5),
    "presentation": (150, 50),
    "lab": (150, 30),
    "programming": (300, 50),
    "project": (360, 100),
    "essay": (210, 100),
    "problem_set": (120, 20),
    "reading": (60, 5),
    "reflection": (45, 10),
    "other": (60, 20),
}

_LABELS: dict[str, str] = {
    "exam": "Exam prep",
    "quiz": "Quiz",
    "discussion": "Discussion post",
    "presentation": "Presentation",
    "lab": "Lab",
    "programming": "Programming assignment",
    "project": "Project",
    "essay": "Writing assignment",
    "problem_set": "Problem set",
    "reading": "Reading",
    "reflection": "Short reflection",
    "other": "Assignment",
}

# Most specific first: "Reading quiz" is a quiz, "Lab report" is a lab, "Final project"
# is a project. Patterns are matched against the title before the description.
_CATEGORY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("quiz", re.compile(r"\bquiz(?:zes)?\b|\bknowledge check\b", re.I)),
    (
        "project",
        re.compile(r"\b(?:final |group |term |course )?project\b|\bcapstone\b|\bprototype\b", re.I),
    ),
    ("exam", re.compile(r"\b(?:midterm|exam|final exam|test)\b", re.I)),
    (
        "discussion",
        re.compile(
            r"\bdiscussion\b|\bforum\b|\b(?:initial |discussion )post\b|\breply\b|\bpeer review\b",
            re.I,
        ),
    ),
    ("presentation", re.compile(r"\bpresentation\b|\bslides?\b|\bpitch\b|\bposter\b", re.I)),
    ("lab", re.compile(r"\blab(?:oratory)?\b|\blab report\b", re.I)),
    (
        "programming",
        re.compile(
            r"\bprogramming\b|\bcoding\b|\bimplement(?:ation)?\b|\bPA\s?\d+\b|\bcode\b", re.I
        ),
    ),
    (
        "essay",
        re.compile(
            r"\bessay\b|\bpaper\b|\breport\b|\bdraft\b|\bthesis\b"
            r"|\bliterature review\b|\bwrite-?up\b|\bmemo\b",
            re.I,
        ),
    ),
    (
        "problem_set",
        re.compile(
            r"\bproblem set\b|\bp-?set\b|\bhomework\b|\bhw\s?\d*\b"
            r"|\bworksheet\b|\bexercises?\b|\bproblems?\b",
            re.I,
        ),
    ),
    ("reflection", re.compile(r"\breflection\b|\bjournal\b|\bresponse\b|\bexit ticket\b", re.I)),
    (
        "reading",
        re.compile(
            r"\breading\b|\bread\b|\bchapters?\b|\bch\.\s?\d|\btextbook\b|\barticle\b", re.I
        ),
    ),
]

_NUMBER = r"(\d{1,3}(?:,\d{3})+|\d+)"
_RANGE_SEP = r"\s*(?:-|–|—|to)\s*"
# "1,500 words", "1,500-word essay", "1000-1500 words", "750+ words"
_WORDS_RE = re.compile(rf"{_NUMBER}(?:{_RANGE_SEP}{_NUMBER})?[\s-]*(?:\+[\s-]*)?words?\b", re.I)
_PAGES_RE = re.compile(
    rf"{_NUMBER}(?:{_RANGE_SEP}{_NUMBER})?[\s-]*"
    r"(?:full\s+|double[- ]spaced\s+|single[- ]spaced\s+)?pages?\b",
    re.I,
)
_PAGE_SPAN_RE = re.compile(r"\b(?:pp?\.|pages)\s*(\d+)\s*(?:-|–|—|to)\s*(\d+)", re.I)
_COUNT_RE = re.compile(
    rf"{_NUMBER}\s*(?:short\s+|practice\s+|multiple[- ]choice\s+)?(problems|questions|exercises)\b",
    re.I,
)
_NUMBERED_SPAN_RE = re.compile(
    r"\b(?:problems|questions|exercises|#)\s*(\d+)\s*(?:-|–|—|to|through)\s*(\d+)", re.I
)
_CHAPTER_SPAN_RE = re.compile(
    r"\b(?:chapters?|ch\.?)\s*(\d+)\s*(?:-|–|—|to|through|and|&)\s*(\d+)", re.I
)
_CHAPTER_ONE_RE = re.compile(r"\b(?:chapter|ch\.?)\s*(\d+)\b", re.I)
_SLIDES_RE = re.compile(rf"{_NUMBER}(?:{_RANGE_SEP}{_NUMBER})?[\s-]*slides?\b", re.I)
_TIME_LIMIT_RE = re.compile(
    r"(?:time limit|timed|you (?:will )?have)\D{0,20}(\d{1,3})\s*(?:min|minutes)\b"
    r"|(\d{1,3})[- ]minute\s+(?:time limit|quiz|exam|test)",
    re.I,
)
_TAG_RE = re.compile(r"<[^>]+>")


# ---------------------------------------------------------------------------
# Public models
# ---------------------------------------------------------------------------


class EstimateSample(BaseModel):
    """One finished task: what StudyFlow first estimated and what it really took."""

    category: str = Field(max_length=32)
    course: str = Field(max_length=80)
    estimated_minutes: int = Field(gt=0, le=10_080)
    actual_minutes: int = Field(gt=0, le=10_080)


class EstimateRequestItem(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(min_length=1, max_length=300)
    course: str = Field(default="", max_length=120)
    description: Optional[str] = Field(default=None, max_length=20_000)  # noqa: UP045
    points: Optional[float] = Field(default=None, ge=0, le=100_000)  # noqa: UP045


class Estimate(BaseModel):
    id: str
    minutes: int
    category: Category
    confidence: Confidence
    reason: str
    base_minutes: int = Field(description="The rules estimate before personal calibration.")
    multiplier: float = Field(description="Personal calibration applied to base_minutes.")


# ---------------------------------------------------------------------------
# Stage 1: rules
# ---------------------------------------------------------------------------


@dataclass
class _Rules:
    minutes: float
    category: str
    confidence: Confidence
    detail: str


def plain_text(description: Optional[str]) -> str:  # noqa: UP045
    """Strip Canvas HTML down to searchable text."""
    if not description:
        return ""
    text = _TAG_RE.sub(" ", description)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def classify(title: str, description: str = "") -> str:
    for text in (title, description[:3000]):
        for category, pattern in _CATEGORY_PATTERNS:
            if pattern.search(text):
                return category
    return "other"


def _num(value: Optional[str]) -> int:  # noqa: UP045
    return int(value.replace(",", "")) if value else 0


def _upper(match: re.Match[str]) -> int:
    """For "1,000-1,500 words" plan for the top of the range."""
    return max(_num(match.group(1)), _num(match.group(2)))


def _rules(title: str, description: str, points: Optional[float]) -> _Rules:  # noqa: UP045
    category = classify(title, description)
    text = f"{title}. {description}"
    writing = category in ("essay", "reflection", "discussion", "lab", "other")

    words = _WORDS_RE.search(text)
    if words and writing and 50 <= _upper(words) <= 20_000:
        count = _upper(words)
        # Drafting runs ~500 words an hour; research, outlining, and revision add about
        # 70% on top for real essays, less for short posts.
        overhead = 1.7 if count >= 600 else 1.3
        return _Rules(count / 500 * 60 * overhead, category, "high", f"~{count:,} words")

    pages = _PAGES_RE.search(text)
    span = _PAGE_SPAN_RE.search(text)
    if category == "reading" and (span or pages):
        count = (int(span.group(2)) - int(span.group(1)) + 1) if span else _upper(pages)  # type: ignore[union-attr]
        if 1 <= count <= 600:
            return _Rules(count * 4, category, "high", f"{count} pages of reading")
    if pages and writing and 1 <= _upper(pages) <= 60:
        count = _upper(pages)
        words_equivalent = count * 275  # a double-spaced page
        return _Rules(
            words_equivalent / 500 * 60 * 1.7,
            "essay" if category == "other" else category,
            "high",
            f"{count} page{'s' if count != 1 else ''} of writing",
        )

    if category in ("quiz", "exam"):
        limit = _TIME_LIMIT_RE.search(text)
        if limit:
            minutes = int(limit.group(1) or limit.group(2))
            if 5 <= minutes <= 300:
                # The sitting itself, plus review beforehand.
                prep = 20 if category == "quiz" else 180
                return _Rules(
                    minutes + prep, category, "high", f"{minutes}-minute time limit plus review"
                )

    if category in ("problem_set", "quiz", "other", "programming"):
        numbered = _NUMBERED_SPAN_RE.search(text)
        counted = _COUNT_RE.search(text)
        count = 0
        if numbered:
            count = int(numbered.group(2)) - int(numbered.group(1)) + 1
        elif counted:
            count = _num(counted.group(1))
        if 1 <= count <= 200:
            per_item = {"quiz": 1.5, "programming": 25}.get(category, 10)
            kind = "questions" if category == "quiz" else "problems"
            resolved = "problem_set" if category == "other" else category
            return _Rules(count * per_item + 10, resolved, "high", f"{count} {kind}")

    if category == "reading":
        chapters = _CHAPTER_SPAN_RE.search(text)
        count = (int(chapters.group(2)) - int(chapters.group(1)) + 1) if chapters else 0
        if not count and _CHAPTER_ONE_RE.search(text):
            count = 1
        if 1 <= count <= 20:
            return _Rules(
                count * 50, category, "high", f"{count} chapter{'s' if count != 1 else ''}"
            )

    if category == "presentation":
        slides = _SLIDES_RE.search(text)
        if slides and 1 <= _upper(slides) <= 100:
            count = _upper(slides)
            return _Rules(count * 12 + 30, category, "high", f"{count} slides plus rehearsal")

    typical, typical_points = _TYPICAL[category]
    if points and points > 0:
        # Points say something about size, but courses scale them differently, so the
        # effect is deliberately gentle (a 4x bigger assignment gets about 1.6x the time).
        factor = min(1.8, max(0.6, (points / typical_points) ** 0.35))
        detail = f"typical {_LABELS[category].lower()}, {points:g} points"
        return _Rules(
            typical * factor, category, "medium" if category != "other" else "low", detail
        )
    if category == "other":
        return _Rules(typical, category, "low", "no details to go on yet")
    return _Rules(typical, category, "medium", f"typical {_LABELS[category].lower()}")


# ---------------------------------------------------------------------------
# Stage 2: calibration
# ---------------------------------------------------------------------------

# How many samples of evidence the "no change" prior is worth at each level. Broader
# levels are weaker evidence about this task, so they need more samples to move it.
_PRIOR_GLOBAL = 12.0
_PRIOR_CATEGORY = 4.0
_PRIOR_COURSE = 3.0


@dataclass
class Calibration:
    multiplier: float
    samples: int
    scope: str  # e.g. "CSE 101 labs", "problem sets", "all work"


def _log_ratios(samples: Iterable[EstimateSample]) -> list[float]:
    ratios = []
    for sample in samples:
        ratio = sample.actual_minutes / sample.estimated_minutes
        ratios.append(math.log(min(3.0, max(1 / 3, ratio))))
    return ratios


def _shrunk(log_ratios: list[float], prior_log: float, prior_weight: float) -> float:
    return (sum(log_ratios) + prior_log * prior_weight) / (len(log_ratios) + prior_weight)


def calibrate(category: str, course: str, history: list[EstimateSample]) -> Calibration:
    """Hierarchical shrinkage: all work → this kind of work → this kind in this course.

    Each level counts only the samples its narrower level doesn't, so a single finished
    task is evidence once, not three times.
    """
    if not history:
        return Calibration(1.0, 0, "")
    same_course = [
        s
        for s in history
        if s.category == category and course and s.course.lower() == course.lower()
    ]
    same_kind_elsewhere = [s for s in history if s.category == category and s not in same_course]
    other_kinds = [s for s in history if s.category != category]

    global_log = _shrunk(_log_ratios(other_kinds), 0.0, _PRIOR_GLOBAL)
    kind_log = _shrunk(_log_ratios(same_kind_elsewhere), global_log, _PRIOR_CATEGORY)
    final_log = _shrunk(_log_ratios(same_course), kind_log, _PRIOR_COURSE)
    same_kind = same_course + same_kind_elsewhere

    multiplier = min(2.5, max(0.5, math.exp(final_log)))
    plural_kind = _plural_label(category)
    if same_course:
        scope, samples = f"{course} {plural_kind}", len(same_course)
    elif same_kind:
        scope, samples = plural_kind, len(same_kind)
    else:
        scope, samples = "all work", len(history)
    return Calibration(multiplier, samples, scope)


def _plural_label(category: str) -> str:
    return {
        "exam": "exams",
        "quiz": "quizzes",
        "discussion": "discussion posts",
        "presentation": "presentations",
        "lab": "labs",
        "programming": "programming assignments",
        "project": "projects",
        "essay": "writing assignments",
        "problem_set": "problem sets",
        "reading": "readings",
        "reflection": "reflections",
    }.get(category, "assignments")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _round(minutes: float) -> int:
    return int(min(MAX_MINUTES, max(MIN_MINUTES, round(minutes / 15) * 15)))


def estimate(item: EstimateRequestItem, history: Optional[list[EstimateSample]] = None) -> Estimate:  # noqa: UP045
    rules = _rules(item.title, plain_text(item.description), item.points)
    base = _round(rules.minutes)
    calibration = calibrate(rules.category, item.course, history or [])
    minutes = _round(base * calibration.multiplier)

    reason = f"{_LABELS[rules.category]} · {rules.detail}"
    change = calibration.multiplier - 1
    if abs(change) >= 0.05 and minutes != base:
        sign = "+" if change > 0 else "−"
        reason += (
            f" · {sign}{abs(change):.0%} for your pace on {calibration.scope} "
            f"({calibration.samples} finished)"
        )
    return Estimate(
        id=item.id,
        minutes=minutes,
        category=rules.category,  # type: ignore[arg-type]
        confidence=rules.confidence,
        reason=reason,
        base_minutes=base,
        multiplier=round(calibration.multiplier, 3),
    )
