import React from "react";
import { TextField } from "@mui/material";
import { FormCard } from "./FormCard";

const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 200;
const RING_CIRCUMFERENCE = 2 * Math.PI * 9;

interface FieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  onChange: (val: string) => void;
}

export const CharQuotaRing: React.FC<{ length: number; max: number }> = ({
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
  multiline = true,
  onChange,
}) => {
  return (
    <div className="form-group">
      <div className="input-ring-wrap">
        <TextField
          id={id}
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          fullWidth
          size="small"
          required
          InputLabelProps={{ shrink: true }}
          inputProps={{ maxLength }}
          sx={{
            [multiline
              ? "& .MuiInputBase-inputMultiline"
              : "& .MuiInputBase-input"]: { paddingRight: "32px" },
          }}
        />
        <CharQuotaRing length={value.length} max={maxLength} />
      </div>
    </div>
  );
};

interface Props {
  title: string;
  description: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
}

export const LessonCard: React.FC<Props> = ({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}) => {
  return (
    <FormCard id="card-lesson-info" title="Curriculum Lesson & Description">
      <LessonTextField
        id="input-title"
        label="Test Title"
        placeholder="Test Title"
        value={title}
        maxLength={TITLE_MAX_LENGTH}
        multiline={false}
        onChange={onTitleChange}
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
