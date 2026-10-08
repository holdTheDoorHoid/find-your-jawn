import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { quiz as t } from '../../strings/en';

// Small building blocks shared by every quiz screen. Native checkboxes and radio buttons do the
// work, so keyboards and screen readers behave without extra code. Everything is at least 44px
// tall (the pick cards are taller), and a selection shows a check mark as well as a color.

/** A big card you can tap, with a native checkbox or radio button inside. */
export function PickCard({
  checked,
  onChange,
  icon,
  label,
  sub,
  type = 'checkbox',
  name,
  disabled,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  icon?: string;
  label: string;
  sub?: string;
  type?: 'checkbox' | 'radio';
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label class={`pick${checked ? ' is-on' : ''}${disabled ? ' is-off' : ''}`}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      {icon && (
        <span class="pick__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span class="pick__text">
        <span class="pick__label">{label}</span>
        {sub && <span class="pick__sub">{sub}</span>}
      </span>
      <span class="pick__tick" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
    </label>
  );
}

/** A small pill with a native checkbox or radio button, built on the site's `.check` style. */
export function Pill({
  checked,
  onChange,
  children,
  type = 'checkbox',
  name,
  disabled,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ComponentChildren;
  type?: 'checkbox' | 'radio';
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label class="check">
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>{children}</span>
    </label>
  );
}

/** A labeled group of pills (or any controls) with a visible question. */
export function Group({ legend, help, children, id }: { legend: string; help?: string; children: ComponentChildren; id?: string }) {
  return (
    <fieldset class="qgroup" id={id}>
      <legend>{legend}</legend>
      {help && <p class="help">{help}</p>}
      <div class="check-row">{children}</div>
    </fieldset>
  );
}

/** A one choice list of pills. Picking a new one replaces the old; there is no tapping twice to undo. */
export function Choices<T extends string | number>({
  legend,
  help,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  help?: string;
  name: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <Group legend={legend} help={help}>
      {options.map((o) => (
        <Pill key={String(o.value)} type="radio" name={name} checked={value === o.value} disabled={disabled} onChange={(on) => on && onChange(o.value)}>
          {o.label}
        </Pill>
      ))}
    </Group>
  );
}

/** The lock: locked means never show anything that breaks the answer, unlocked means prefer it. */
export function LockSwitch({ locked, onChange, id }: { locked: boolean; onChange: (locked: boolean) => void; id: string }) {
  return (
    <div class={`lock${locked ? ' is-locked' : ''}`}>
      <label class="switch">
        <input type="checkbox" checked={locked} aria-describedby={`${id}-help`} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
        <span>
          <span aria-hidden="true">{locked ? '🔒 ' : '🔓 '}</span>
          {t.lock.label}
          <small id={`${id}-help`}>{locked ? t.lock.on : t.lock.off}</small>
        </span>
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, help, id }: { checked: boolean; onChange: (on: boolean) => void; label: string; help?: string; id?: string }) {
  return (
    <label class="switch">
      <input type="checkbox" checked={checked} aria-describedby={help && id ? `${id}-help` : undefined} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>
        {label}
        {help && <small id={id ? `${id}-help` : undefined}>{help}</small>}
      </span>
    </label>
  );
}

export function PrivacyNote({ children }: { children: ComponentChildren }) {
  return (
    <p class="privacy-note">
      <span aria-hidden="true">{'🔒 '}</span>
      {children}
    </p>
  );
}

/** The progress bar. It moves fast at first and slows near the end, and says so in words. */
export function Progress({ percent, label }: { percent: number; label: string }) {
  return (
    <div class="qprogress" role="progressbar" aria-label={t.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={label}>
      <div class="qprogress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** One screen: a heading that takes focus when the screen changes, help text, the body and the buttons. */
export function Frame({
  title,
  help,
  children,
  focusKey,
  grabFocus,
}: {
  title: string;
  help?: string;
  children: ComponentChildren;
  focusKey: string;
  grabFocus: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!grabFocus) return;
    ref.current?.focus({ preventScroll: true });
    try {
      ref.current?.scrollIntoView({ block: 'start' });
    } catch {
      // older browsers
    }
  }, [focusKey, grabFocus]);
  return (
    <section class="qframe" aria-labelledby={`h-${focusKey}`}>
      <h2 id={`h-${focusKey}`} ref={ref} tabIndex={-1}>
        {title}
      </h2>
      {help && <p class="help qhelp">{help}</p>}
      {children}
    </section>
  );
}

/** The buttons at the bottom of a screen. The main button says Skip until something is answered. */
export function Nav({
  onBack,
  onNext,
  answered,
  nextLabel,
  canBack,
  disabled,
}: {
  onBack: () => void;
  onNext: () => void;
  answered: boolean;
  nextLabel?: string;
  canBack: boolean;
  disabled?: boolean;
}) {
  return (
    <div class="qnav">
      {canBack ? (
        <button type="button" class="btn btn--quiet" onClick={onBack}>
          {t.back}
        </button>
      ) : (
        <span />
      )}
      <button type="button" class={`btn${answered ? '' : ' btn--secondary'}`} disabled={disabled} onClick={onNext}>
        {nextLabel ?? (answered ? t.next : t.skip)}
      </button>
    </div>
  );
}
