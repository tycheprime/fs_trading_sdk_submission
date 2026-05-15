import type { CSSProperties } from 'react';
import { Panel } from './Panel';
import { MONO } from '../theme';
import { formatUsd } from '../format';
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

// The agent's control center: latest estimate, payout preview, and the
// run / arm / interval / position-size controls.
export function AgentPanel({ agent }: { agent: UseAgentResult }) {
  const estimate = agent.currentCycle?.estimate ?? null;
  const build = agent.currentCycle?.beliefBuild ?? null;
  const payout = agent.payout;

  return (
    <Panel title="Agent Control">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Estimate readout */}
        {estimate ? (
          <div>
            <div style={labelStyle}>Forecast — BTC on 2026-12-31</div>
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
              {formatUsd(estimate.pointEstimate)}
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
                90% CI {formatUsd(estimate.low)} – {formatUsd(estimate.high)}
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
            </div>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--fs-text)',
                fontStyle: 'italic',
              }}
            >
              “{estimate.rationale}”
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
                belief: gaussian, center {formatUsd(build.center)}, spread ±
                {formatUsd(build.spread)}
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
            No forecast yet. Run a cycle to have the agent search exa.ai and
            build its belief.
          </div>
        )}

        {/* Payout preview */}
        {payout && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: MONO,
              fontSize: 12,
              borderTop: '1px solid var(--fs-border)',
              borderBottom: '1px solid var(--fs-border)',
              padding: '8px 0',
            }}
          >
            <span style={{ color: 'var(--fs-text-secondary)' }}>
              max payout{' '}
              <strong style={{ color: 'var(--fs-positive)' }}>
                {formatUsd(payout.maxPayout)}
              </strong>
            </span>
            <span style={{ color: 'var(--fs-text-secondary)' }}>
              if BTC ≈{' '}
              <strong style={{ color: 'var(--fs-text)' }}>
                {formatUsd(payout.maxPayoutOutcome)}
              </strong>
            </span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleRow
            label="Auto-cycle"
            hint={
              agent.autoMode && agent.secondsUntilNext != null
                ? `next cycle in ${agent.secondsUntilNext}s`
                : 'run the loop on a timer'
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

          <ToggleRow
            label="Auto-trade"
            hint={
              agent.armed
                ? agent.isAuthenticated
                  ? 're-positions every cycle'
                  : 'log in to enable trading'
                : 'arm to trade automatically'
            }
            hintColor={
              agent.armed && !agent.isAuthenticated
                ? 'var(--fs-negative)'
                : undefined
            }
            on={agent.armed}
            onChange={agent.setArmed}
          />

          <NumberRow
            label="Position size"
            suffix="$"
            value={agent.positionSize}
            min={1}
            step={5}
            onChange={agent.setPositionSize}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={agent.runCycleNow}
            disabled={agent.busy || agent.marketLoading}
            style={buttonStyle(false, agent.busy || agent.marketLoading)}
          >
            {agent.busy ? 'Running…' : 'Run cycle now'}
          </button>
          <button
            onClick={agent.commitNow}
            disabled={
              agent.busy ||
              !agent.isAuthenticated ||
              !agent.currentCycle?.beliefBuild
            }
            style={buttonStyle(
              true,
              agent.busy ||
                !agent.isAuthenticated ||
                !agent.currentCycle?.beliefBuild,
            )}
          >
            Commit belief
          </button>
        </div>

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

function buttonStyle(filled: boolean, disabled: boolean): CSSProperties {
  return {
    flex: 1,
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '10px 8px',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: '1px solid var(--fs-primary)',
    background: filled ? 'var(--fs-primary)' : 'transparent',
    color: filled ? '#1a1206' : 'var(--fs-primary)',
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
