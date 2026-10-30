import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { useI18n } from '../i18n';

/** Let required names be cleared temporarily while editing without saving invalid documents. */
export function TextInput({
  value,
  onValue,
  required = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValue: (value: string) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const hintId = useId();
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const invalid = required && !draft.trim();
  return (
    <>
      <input
        {...props}
        value={draft}
        required={required}
        aria-invalid={Boolean(invalid)}
        aria-describedby={invalid ? hintId : props['aria-describedby']}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!required || next.trim()) onValue(next);
        }}
        onBlur={() => {
          focused.current = false;
          if (invalid) setDraft(value);
        }}
      />
      {invalid && (
        <span className="field-hint" id={hintId} aria-hidden="true">
          {t('editor.requiredTextHint')}
        </span>
      )}
    </>
  );
}
