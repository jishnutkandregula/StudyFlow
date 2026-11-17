"use client";

import { useState } from "react";
import type { DailyAvailability, Preferences, ProtectedBlock } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  availability: DailyAvailability[];
  onAvailabilityChange: (day: number, changes: Partial<DailyAvailability>) => void;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
  protectedBlocks: ProtectedBlock[];
  onProtectedBlocksChange: (blocks: ProtectedBlock[]) => void;
  onDeleteData: () => Promise<void>;
};

const emptyBlock: ProtectedBlock = { label: "", days_of_week: [0], start_time: "17:00:00", end_time: "18:00:00" };
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const toInput = (value: string) => value.slice(0, 5);
const fromInput = (value: string) => `${value}:00`;

export function PreferencesPanel(props: Props) {
  const { availability, preferences, protectedBlocks } = props;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProtectedBlock>(emptyBlock);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (changes: Partial<Preferences>) => props.onPreferencesChange({ ...preferences, ...changes });

  function toggleDay(day: number) {
    setDraft((current) => ({
      ...current,
      days_of_week: current.days_of_week.includes(day)
        ? current.days_of_week.filter((item) => item !== day)
        : [...current.days_of_week, day].sort(),
    }));
  }

  function addBlock() {
    if (!draft.label.trim() || !draft.days_of_week.length || draft.end_time <= draft.start_time) return;
    props.onProtectedBlocksChange([...protectedBlocks, { ...draft, label: draft.label.trim() }]);
    setDraft(emptyBlock);
  }

  return (
    <section id="preferences" className={`preferences-panel${open ? " open" : ""}`}>
      <button className="preferences-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="preferences-body">
        <span><Icon name="settings" /></span>
        <div>
          <p className="kicker">GUARDRAILS</p>
          <strong>Shape a plan around your actual life</strong>
          <small>Availability, sleep, meals, daily cap, and recurring commitments</small>
        </div>
        <Icon name="arrow" />
      </button>
      {open && (
        <div className="preferences-body" id="preferences-body">
          <fieldset className="availability-editor">
            <legend>When can you study?</legend>
            {availability.map((day) => (
              <div className="availability-row" key={day.day_of_week}>
                <strong>{day.label}</strong>
                <label>
                  <input type="checkbox" checked={!day.is_day_off} onChange={(e) => props.onAvailabilityChange(day.day_of_week, { is_day_off: !e.target.checked })} />
                  Available
                </label>
                <input type="time" aria-label={`${day.label} start`} disabled={day.is_day_off} value={toInput(day.start_time)} onChange={(e) => props.onAvailabilityChange(day.day_of_week, { start_time: fromInput(e.target.value) })} />
                <span>to</span>
                <input type="time" aria-label={`${day.label} end`} disabled={day.is_day_off} value={toInput(day.end_time)} onChange={(e) => props.onAvailabilityChange(day.day_of_week, { end_time: fromInput(e.target.value) })} />
              </div>
            ))}
          </fieldset>
          <fieldset className="guardrail-editor">
            <legend>Protect your rhythm</legend>
            <div className="field-grid">
              <label>Sleep<input type="time" value={toInput(preferences.sleep_start)} onChange={(e) => set({ sleep_start: fromInput(e.target.value) })} /></label>
              <label>Wake<input type="time" value={toInput(preferences.wake_time)} onChange={(e) => set({ wake_time: fromInput(e.target.value) })} /></label>
              <label>Lunch from<input type="time" value={toInput(preferences.lunch_start)} onChange={(e) => set({ lunch_start: fromInput(e.target.value) })} /></label>
              <label>Lunch to<input type="time" value={toInput(preferences.lunch_end)} onChange={(e) => set({ lunch_end: fromInput(e.target.value) })} /></label>
              <label>Dinner from<input type="time" value={toInput(preferences.dinner_start)} onChange={(e) => set({ dinner_start: fromInput(e.target.value) })} /></label>
              <label>Dinner to<input type="time" value={toInput(preferences.dinner_end)} onChange={(e) => set({ dinner_end: fromInput(e.target.value) })} /></label>
              <label>Focus block (min)<input min="25" max="120" step="5" type="number" value={preferences.focus_session_minutes} onChange={(e) => set({ focus_session_minutes: e.target.value })} /></label>
              <label>Daily cap (min)<input min="60" max="720" step="30" type="number" value={preferences.max_study_minutes_per_day} onChange={(e) => set({ max_study_minutes_per_day: e.target.value })} /></label>
            </div>
            <p className="field-hint">Recurring commitments (work, practice, clubs) never get study sessions.</p>
            <div className="protected-form">
              <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Work shift" aria-label="Commitment name" />
              <input type="time" aria-label="Commitment start" value={toInput(draft.start_time)} onChange={(e) => setDraft({ ...draft, start_time: fromInput(e.target.value) })} />
              <input type="time" aria-label="Commitment end" value={toInput(draft.end_time)} onChange={(e) => setDraft({ ...draft, end_time: fromInput(e.target.value) })} />
              <button type="button" onClick={addBlock} aria-label="Add commitment"><Icon name="plus" /></button>
            </div>
            <div className="day-pills" role="group" aria-label="Commitment days">
              {dayNames.map((label, day) => (
                <button type="button" aria-pressed={draft.days_of_week.includes(day)} className={draft.days_of_week.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)} key={label}>
                  {label}
                </button>
              ))}
            </div>
            {protectedBlocks.map((block, index) => (
              <div className="protected-item" key={`${block.label}-${index}`}>
                <span>
                  {block.label} · {block.days_of_week.map((day) => dayNames[day]).join(", ")} · {toInput(block.start_time)}–{toInput(block.end_time)}
                </span>
                <button onClick={() => props.onProtectedBlocksChange(protectedBlocks.filter((_, i) => i !== index))}>Remove</button>
              </div>
            ))}
          </fieldset>
          <section className="data-controls" aria-labelledby="data-heading">
            <h3 id="data-heading">Your data</h3>
            <p>
              StudyFlow saves your coursework, settings, and plan for this browser so they survive a reload. Calendar
              event titles are never saved, only when you’re busy. A connected Canvas token is stored encrypted and is
              never sent back to your browser. <a href="/privacy">Read the privacy details</a>.
            </p>
            {confirmDelete ? (
              <div className="confirm-row" role="group" aria-label="Confirm delete">
                <span>Delete all saved coursework, settings, plans, and the Canvas connection? This can’t be undone.</span>
                <button
                  className="danger-button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await props.onDeleteData();
                    } finally {
                      setDeleting(false);
                      setConfirmDelete(false);
                    }
                  }}
                >
                  {deleting ? "Deleting…" : "Delete everything"}
                </button>
                <button className="quiet-action" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button className="danger-link" onClick={() => setConfirmDelete(true)}>Delete my StudyFlow data</button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
