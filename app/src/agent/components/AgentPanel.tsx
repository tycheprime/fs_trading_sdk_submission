import type { CSSProperties } from 'react';
import { Panel } from './Panel';
import { MONO } from '../theme';
import { DISTRIBUTION_LABELS } from '../belief';
import { SHAPE_HINTS } from '../shapeHints';
import { formatOutcome } from '../format';
import type { UseAgentResult } from '../useAgent';

const CONFIDENCE_COLOR: Record<string, string> = {
  low: 'var(--fs-negative)',
  medium: 'var(--fs-accent)',
  high: 'var(--fs-positive)',
};

const labelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--fs-text-secondary)',
};

// The agent's control center: latest estimate and the run / auto-cycle /
// interval controls.
export function AgentPanel({ agent }: { agent: UseAgentResult }) {
  const estimate = agent.forecast;
  const build = agent.beliefBuild ?? agent.currentCycle?.beliefBuild ?? null;
  const units = agent.market?.xAxisUnits ?? '';

  return (
    <Panel title="Agent Control">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Estimate readout */}
        {estimate ? (
          <div>
            <div style={labelStyle}>
              {DISTRIBUTION_LABELS[estimate.distributionType]} forecast
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 30,
                fontWeight: 700,
                color: 'var(--fs-primary)',
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              {formatOutcome(estimate.pointEstimate, units)}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 6,
                fontFamily: MONO,
                fontSize: 12,
                color: 'var(--fs-text-secondary)',
                flexWrap: 'wrap',
              }}
            >
              <span>
                90% band {formatOutcome(estimate.low, units)} –{' '}
                {formatOutcome(estimate.high, units)}
              </span>
              <span
                style={{
                  color: CONFIDENCE_COLOR[estimate.confidence],
                  border: `1px solid ${CONFIDENCE_COLOR[estimate.confidence]}`,
                  borderRadius: 4,
                  padding: '1px 7px',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                }}
              >
                {estimate.confidence.toUpperCase()} CONFIDENCE
              </span>
              {estimate.changedMind ? (
                <span style={{ color: 'var(--fs-accent)' }}>changed mind</span>
              ) : (
                <span>held forecast</span>
              )}
            </div>
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--fs-border)',
                background: 'var(--fs-bg-secondary, #0b0e13)',
              }}
            >
              <div style={labelStyle}>Why this shape</div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fs-text-secondary)',
                }}
              >
                {SHAPE_HINTS[estimate.distributionType]}
              </p>
            </div>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--fs-text-secondary)',
              }}
            >
              {estimate.rationale}
            </p>
            {build && (
              <div
                style={{
                  ...labelStyle,
                  marginTop: 8,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                on chart: {build.label} · center{' '}
                {formatOutcome(build.center, units)}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: 'var(--fs-text-secondary)',
              padding: '8px 0',
            }}
          >
            Waiting for first forecast. Auto-cycle runs exa every 20s and
            calls Claude only when new articles appear.
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleRow
            label="Auto-cycle"
            hint={
              agent.autoMode && agent.secondsUntilNext != null
                ? `next cycle in ${agent.secondsUntilNext}s`
                : `exa search every ${agent.intervalSec}s`
            }
            on={agent.autoMode}
            onChange={agent.setAutoMode}
          />

          <NumberRow
            label="Cycle interval"
            suffix="sec"
            value={agent.intervalSec}
            min={20}
            step={10}
            onChange={agent.setIntervalSec}
          />
        </div>

        {/* Action */}
        <button
          onClick={agent.runCycleNow}
          disabled={agent.busy || agent.marketLoading}
          style={buttonStyle(agent.busy || agent.marketLoading)}
        >
          {agent.busy ? 'Running…' : 'Run cycle now'}
        </button>

        {agent.error && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--fs-negative)',
              border: '1px solid var(--fs-negative)',
              borderRadius: 6,
              padding: '8px 10px',
              lineHeight: 1.45,
            }}
          >
            {agent.error}
          </div>
        )}
      </div>
    </Panel>
  );
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '10px 8px',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: '1px solid var(--fs-primary)',
    background: 'var(--fs-primary)',
    color: '#1a1206',
  };
}
function ToggleRow({
  label,
  hint,
  on,
  onChange,
  hintColor,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hintColor?: string;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div
          style={{
            fontSize: 11,
            color: hintColor ?? 'var(--fs-text-secondary)',
            fontFamily: MONO,
          }}
        >
          {hint}
        </div>
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: '1px solid var(--fs-border)',
          background: on ? 'var(--fs-primary)' : 'var(--fs-bg-secondary, #11161f)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: on ? '#1a1206' : 'var(--fs-text-secondary)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
}

function NumberRow({
  label,
  suffix,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--fs-text-secondary)' }}>
          {suffix}
        </span>
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= min) onChange(n);
          }}
          style={{
            width: 72,
            fontFamily: MONO,
            fontSize: 13,
            padding: '6px 8px',
            borderRadius: 5,
            border: '1px solid var(--fs-border)',
            background: 'var(--fs-input-bg, #0b0e13)',
            color: 'var(--fs-text)',
          }}
        />
      </div>
    </div>
  );
}

