"use client";

import { useEpicProgress, type ClassName } from "@/components/EpicProgressProvider";

type EpicTrackerCheckboxProps = {
  className: ClassName;
  stepIndex: number;
  label: string;
};

/**
 * A checkbox that persists quest step completion state via EpicProgressProvider.
 *
 * Visual states:
 *   - Unchecked: outlined box using --border token
 *   - Checked: filled box using --accent token
 *   - Hover: uses --filter-hover-bg / --filter-hover-border tokens (no new tokens)
 */
export function EpicTrackerCheckbox({ className, stepIndex, label }: EpicTrackerCheckboxProps) {
  const { getProgress, markStepComplete, unmarkStep } = useEpicProgress();
  const progress = getProgress(className);
  const isChecked = progress.completed.includes(stepIndex);

  function handleChange() {
    if (isChecked) {
      unmarkStep(className, stepIndex);
    } else {
      markStepComplete(className, stepIndex);
    }
  }

  return (
    <label className={`epic-checkbox ${isChecked ? "is-checked" : ""}`} title={isChecked ? "Mark incomplete" : "Mark complete"}>
      <input
        aria-label={label}
        checked={isChecked}
        className="epic-checkbox-input"
        onChange={handleChange}
        type="checkbox"
      />
      <span aria-hidden className="epic-checkbox-box" />
    </label>
  );
}
