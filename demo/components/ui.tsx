import { useId } from 'react';

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
  width = 170
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  width?: number;
}) {
  // a real htmlFor/id pair, so clicking the label focuses the slider and
  // arrow keys work straight away
  const id = useId();
  return (
    <div className="wb-field" style={{ width }}>
      <label className="wb-label" htmlFor={id}>
        {label}
        <b>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </b>
      </label>
      <input
        id={id}
        className="wb-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export function Toggle({
  label,
  on,
  onToggle
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="wb-btn" type="button" aria-pressed={on} onClick={onToggle}>
      {label}
    </button>
  );
}

export function BtnGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  fmt
}: {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  fmt?: (v: T) => string;
}) {
  return (
    <div className="wb-field">
      {label ? <span className="wb-label">{label}</span> : null}
      <div className="wb-btns">
        {options.map((o) => (
          <button
            key={String(o)}
            className="wb-btn"
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
          >
            {fmt ? fmt(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
