/**
 * Shadow DOM styles of <otape-player>.
 *
 * Theme it from the page with custom properties on the element, e.g.
 * `otape-player { --otape-accent: #3fa7d6; }`, or style its parts with
 * `otape-player::part(display) { … }`.
 */
export const STYLES = /* css */ `
:host {
  --otape-font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --otape-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --otape-surface: #1d1d20;
  --otape-surface-raised: #2a2a2e;
  --otape-well: #101012;
  --otape-line: rgb(255 255 255 / 0.08);
  --otape-text: #f2f1ec;
  --otape-muted: #9b9a94;
  --otape-accent: #e4572e;
  --otape-display: #11160f;
  --otape-display-text: #b8f27c;
  --otape-recorded: rgb(184 242 124 / 0.35);
  --otape-radius: 18px;
  --otape-focus: 0 0 0 2px var(--otape-surface), 0 0 0 4px var(--otape-accent);

  display: block;
  container-type: inline-size;
  font-family: var(--otape-font);
  color: var(--otape-text);
}

:host([hidden]) { display: none; }

*, *::before, *::after { box-sizing: border-box; }

button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}

button:focus-visible, [role='slider']:focus-visible, summary:focus-visible, input:focus-visible {
  outline: none;
  box-shadow: var(--otape-focus);
}

.player {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: var(--otape-radius);
  background: linear-gradient(180deg, var(--otape-surface-raised), var(--otape-surface));
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.06) inset, 0 20px 50px rgb(0 0 0 / 0.35);
}

/* ----- stage: the cassette well ----- */

.stage {
  position: relative;
  aspect-ratio: 100.4 / 63.8;
  border-radius: calc(var(--otape-radius) - 6px);
  background: radial-gradient(120% 120% at 50% 0%, #26262b, var(--otape-well));
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.6) inset;
  perspective: 900px;
  overflow: hidden;
}

.stage.drag-over { box-shadow: 0 0 0 2px var(--otape-accent) inset; }

.cassette {
  position: absolute;
  inset: 6% 5%;
  transition: transform 280ms ease-in, opacity 280ms ease-in;
  transform-style: preserve-3d;
  filter: drop-shadow(0 10px 18px rgb(0 0 0 / 0.5));
}

.cassette svg { display: block; width: 100%; height: 100%; }
.cassette.is-flipping { transform: rotateY(90deg); opacity: 0.6; }
.cassette.is-entering { transform: translateY(-40%); opacity: 0; transition: none; }

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  padding: 16px;
  text-align: center;
  color: var(--otape-muted);
}

.empty svg { width: 44px; height: 44px; fill: currentColor; opacity: 0.6; }
.empty p { margin: 0; }

.choose {
  padding: 8px 16px;
  border: 1px solid var(--otape-line);
  border-radius: 999px;
  background: var(--otape-surface-raised);
}

/* ----- display ----- */

.display {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--otape-display);
  color: var(--otape-display-text);
  font-family: var(--otape-mono);
  font-size: 13px;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.6) inset;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.counter {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.45);
  font-size: 18px;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--otape-font);
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--otape-text);
}

.badge {
  padding: 1px 7px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 12px;
}

.meta, .now { color: var(--otape-muted); font-family: var(--otape-font); font-size: 12.5px; }
.now { min-height: 1.4em; color: var(--otape-display-text); }
.spacer { flex: 1; }
.time { font-size: 15px; font-variant-numeric: tabular-nums; }
.status { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11.5px; }

.tapemap {
  position: relative;
  height: 18px;
  border-radius: 4px;
  background: rgb(255 255 255 / 0.06);
  cursor: pointer;
  touch-action: none;
}

.tapemap__recorded {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px 0 0 4px;
  background: var(--otape-recorded);
}

.tapemap__marker {
  position: absolute;
  top: 3px;
  bottom: 3px;
  width: 2px;
  margin-left: -1px;
  background: var(--otape-display-text);
  opacity: 0.55;
}

.tapemap__head {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: var(--otape-accent);
  box-shadow: 0 0 8px var(--otape-accent);
}

/* ----- transport ----- */

.transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.key {
  display: inline-grid;
  place-items: center;
  width: 52px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(180deg, #3a3a40, #2c2c31);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.12) inset, 0 3px 0 #141416, 0 4px 8px rgb(0 0 0 / 0.4);
  transition: transform 80ms ease, box-shadow 80ms ease;
}

.key svg { width: 22px; height: 22px; fill: currentColor; }
.key:active, .key[aria-pressed='true'] {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.08) inset, 0 1px 0 #141416;
}
.key[aria-pressed='true'] { color: var(--otape-accent); }
.key:disabled { opacity: 0.4; cursor: default; }

.volume {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: var(--otape-muted);
  font-size: 12px;
}

.volume input { width: 96px; accent-color: var(--otape-accent); }

/* ----- messages and details ----- */

.alert {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(228 87 46 / 0.15);
  color: #ffb9a3;
  font-size: 13px;
}

.alert ul { margin: 6px 0 0; padding-left: 18px; }

.info {
  border-top: 1px solid var(--otape-line);
  padding-top: 12px;
  font-size: 13.5px;
}

.info summary { cursor: pointer; color: var(--otape-muted); }

.info__body {
  display: grid;
  grid-template-columns: minmax(0, 150px) minmax(0, 1fr);
  gap: 16px;
  margin-top: 14px;
}

.jcard svg { display: block; width: 100%; border-radius: 3px; box-shadow: 0 6px 18px rgb(0 0 0 / 0.4); }

.info h3 {
  margin: 0 0 6px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--otape-muted);
}

.info section + section { margin-top: 14px; }
.info p { margin: 0 0 6px; line-height: 1.45; }
.info a { color: var(--otape-display-text); }

.markers { list-style: none; margin: 0; padding: 0; }

.markers button {
  display: flex;
  width: 100%;
  gap: 10px;
  padding: 4px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  text-align: left;
}

.markers button:hover { background: rgb(255 255 255 / 0.06); }
.markers time { color: var(--otape-muted); font-family: var(--otape-mono); font-variant-numeric: tabular-nums; }
.markers [aria-current='true'] { color: var(--otape-display-text); }

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--otape-display-text);
  text-decoration: underline;
}

.license {
  max-height: 200px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 10px;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.3);
  font-family: var(--otape-mono);
  font-size: 12px;
  white-space: pre-wrap;
}

.warnings { margin: 0; padding-left: 18px; color: var(--otape-muted); }

[hidden] { display: none !important; }

@container (max-width: 520px) {
  .player { padding: 12px; gap: 12px; }
  .key { width: 44px; height: 40px; }
  .volume { width: 100%; margin-left: 0; }
  .volume input { flex: 1; }
  .info__body { grid-template-columns: 1fr; }
  .jcard { max-width: 160px; }
}

@media (prefers-reduced-motion: reduce) {
  .cassette, .key { transition: none; }
}
`;
