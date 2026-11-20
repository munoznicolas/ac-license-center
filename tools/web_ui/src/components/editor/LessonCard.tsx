import React, { useLayoutEffect, useRef } from "react";
import { FormCard } from "./FormCard";

const OBJECTIVE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 200;
const RING_CIRCUMFERENCE = 2 * Math.PI * 9;

interface FieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChange: (val: string) => void;
}

const CharQuotaRing: React.FC<{ length: number; max: number }> = ({
  length,
  max,
}) => {
  const ratio = Math.min(length / max, 1);
  if (ratio < 0.75) return null;

  const stateClass =
    ratio >= 1 ? "is-limit" : ratio >= 0.9 ? "is-warning" : "";
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);

  return (
    <svg
      className={`char-ring is-visible ${stateClass}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="char-ring-track" cx="12" cy="12" r="9" />
      <circle
        className="char-ring-fill"
        cx="12"
        cy="12"
        r="9"
        style={{ strokeDashoffset: dashOffset }}
      />
    </svg>
  );
};

const LessonTextField: React.FC<FieldProps> = ({
  id,
  label,
  placeholder,
  value,
  maxLength,
  onChange,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="input-ring-wrap">
        <textarea
          ref={ref}
          id={id}
          className="form-control"
          rows={2}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <CharQuotaRing length={value.length} max={maxLength} />
      </div>
    </div>
  );
};

interface Props {
  objective: string;
  description: string;
  onObjectiveChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
}

export const LessonCard: React.FC<Props> = ({
  objective,
  description,
  onObjectiveChange,
  onDescriptionChange,
}) => {
  return (
    <FormCard id="card-lesson-info" title="Curriculum Lesson & Description">
      <LessonTextField
        id="input-objective"
        label="Lesson Objective"
        placeholder="Driving technique to practice"
        value={objective}
        maxLength={OBJECTIVE_MAX_LENGTH}
        onChange={onObjectiveChange}
      />
      <LessonTextField
        id="input-description"
        label="Test Description / Instruction"
        placeholder="Instruction displayed during countdown"
        value={description}
        maxLength={DESCRIPTION_MAX_LENGTH}
        onChange={onDescriptionChange}
      />
    </FormCard>
  );
};
