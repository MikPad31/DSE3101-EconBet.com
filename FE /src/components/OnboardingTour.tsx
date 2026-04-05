import React, { useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const ONBOARDING_STORAGE_KEY = 'macrocas_onboarding_done_v1';

const PAD = 10;

type Placement = 'right' | 'left' | 'bottom' | 'top';

type TourStep = {
  target: string;
  title: string;
  body: string;
  placement: Placement;
  /** e.g. force Overview so chart mount exists */
  prepare?: 'overview' | 'forward';
};

const STEPS: TourStep[] = [
  {
    target: 'tour-header',
    title: 'Status bar',
    body: 'Use this bar to quickly check what you are viewing: terminal name, data vintage, update time, frequency, source, and active model badges. To reopen this walkthrough later, go to Profile → User Guide.',
    placement: 'bottom',
  },
  {
    target: 'tour-sidebar-models',
    title: 'Model toggles',
    body: 'Use these switches to show or hide forecast lines on the chart. Turn individual models on to compare them against official GDP, or turn them off to simplify the view.',
    placement: 'right',
  },
  {
    target: 'tour-sidebar-mix',
    title: 'Ensemble weights',
    body: 'Turn on Custom weights to build your own combined nowcast. Adjust the AR, ADL, and Random Forest sliders to change how much each model contributes. The weights will always rescale to 100% automatically.',
    placement: 'right',
  },
  {
    target: 'tour-sidebar-scenario',
    title: 'Scenario window',
    body: 'Use this menu to jump to a specific macro episode. Choose Live to view the full series, or select a preset window to focus the chart and KPI ribbon on that period.',
    placement: 'right',
  },
  {
    target: 'tour-sidebar-footer',
    title: 'Model Performance & theme',
    body: 'Open Model Performance to review forecast accuracy and directional hit rates. Use the sun and moon toggle to switch between light and dark terminal themes.',
    placement: 'right',
  },
  {
    target: 'tour-kpi',
    title: 'KPI ribbon',
    body: 'This ribbon gives you the main readout at a glance: nowcast, recession risk, next-quarter forecast, and certainty range. The Recession Risk is calculated using a normal cumulative distribution function (CDF) based on the ensemble model\'s confidence interval, determining the probability that GDP growth falls below 0%.',
    placement: 'bottom',
  },
  {
    target: 'tour-tabs',
    title: 'Workspace tabs',
    body: 'Use these tabs to move between views. Overview shows the GDP path chart, while Forward Outlook shows additional forward-looking signals and trajectory views.',
    placement: 'bottom',
  },
  {
    target: 'tour-ragged-edge',
    title: 'Ragged Edge',
    body: 'Check the Ragged Edge tab to simulate the current day of the month and see how data availability impacts model readiness. It uses a heuristic release calendar to calculate health scores for each model based on the availability of its required macroeconomic indicators.',
    placement: 'bottom',
  },
  {
    target: 'tour-chart',
    title: 'GDP path chart',
    body: 'This is the main chart area. Compare official GDP with the selected model tracks, hover over points to inspect values, and use the 1Y, 5Y, 10Y, MAX buttons or the slider below to change the visible time range.',
    placement: 'top',
    prepare: 'overview',
  },
];

type OnboardingTourProps = {
  open: boolean;
  onClose: (opts: { neverAgain: boolean }) => void;
  /** Switch workspace when a step needs a tab (e.g. chart mount) */
  onPrepareStep?: (prepare: TourStep['prepare']) => void;
  /** e.g. activeTab — remeasure after layout */
  layoutKey?: string;
};

function SpotlightMask({ rect }: { rect: DOMRect }) {
  const t = Math.max(0, rect.top - PAD);
  const l = Math.max(0, rect.left - PAD);
  const r = rect.right + PAD;
  const b = rect.bottom + PAD;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const midH = Math.max(0, b - t);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[240] bg-black/70 pointer-events-auto" style={{ height: t }} />
      <div className="fixed left-0 right-0 z-[240] bg-black/70 pointer-events-auto" style={{ top: b, bottom: 0 }} />
      <div className="fixed left-0 z-[240] bg-black/70 pointer-events-auto" style={{ top: t, width: l, height: midH }} />
      <div className="fixed z-[240] bg-black/70 pointer-events-auto" style={{ top: t, left: r, width: Math.max(0, vw - r), height: midH }} />
      <div
        className="fixed z-[241] rounded-md pointer-events-none border-2 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
        style={{
          top: t,
          left: l,
          width: r - l,
          height: b - t,
          borderColor: 'var(--color-brand-primary)',
          boxShadow: '0 0 24px color-mix(in srgb, var(--color-brand-primary) 35%, transparent)',
        }}
      />
    </>
  );
}

export function OnboardingTour({ open, onClose, onPrepareStep, layoutKey = '' }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [neverAgain, setNeverAgain] = useState(false);
  const [missingTarget, setMissingTarget] = useState(false);

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  useEffect(() => {
    if (open) {
      setStep(0);
      setNeverAgain(false);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const prep = STEPS[step].prepare;
    if (prep) onPrepareStep?.(prep);

    const runMeasure = () => {
      const stepDef = STEPS[step];
      const el = document.querySelector(`[data-tour="${stepDef.target}"]`) as HTMLElement | null;
      if (!el) {
        setRect(null);
        setMissingTarget(true);
        setTooltipStyle({
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(22rem, calc(100vw - 2rem))',
          zIndex: 250,
        });
        setArrowStyle({ display: 'none' });
        return;
      }
      setMissingTarget(false);
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      const r = el.getBoundingClientRect();
      setRect(r);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tw = 320;
      const estTooltipH = Math.min(420, Math.max(260, vh - 32));
      const gap = 16;
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const t = Math.max(0, r.top - PAD);
      const l = Math.max(0, r.left - PAD);
      const rr = r.right + PAD;
      const b = r.bottom + PAD;

      let left = 16;
      let top = 16;
      let arrow: React.CSSProperties = { display: 'none' };

      if (stepDef.placement === 'right') {
        left = Math.min(rr + gap, vw - tw - 16);
        top = Math.min(Math.max(16, cy - estTooltipH / 2), vh - estTooltipH - 16);
        arrow = {
          display: 'block',
          position: 'absolute',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: '8px solid var(--card)',
          filter: 'drop-shadow(-2px 0 1px rgba(0,0,0,0.15))',
        };
      } else if (stepDef.placement === 'left') {
        left = Math.max(16, l - tw - gap);
        top = Math.min(Math.max(16, cy - estTooltipH / 2), vh - estTooltipH - 16);
        arrow = {
          display: 'block',
          position: 'absolute',
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '8px solid var(--card)',
        };
      } else if (stepDef.placement === 'bottom') {
        left = Math.min(Math.max(16, cx - tw / 2), vw - tw - 16);
        top = Math.min(b + gap, vh - estTooltipH - 16);
        arrow = {
          display: 'block',
          position: 'absolute',
          left: '50%',
          top: -8,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid var(--card)',
        };
      } else {
        left = Math.min(Math.max(16, cx - tw / 2), vw - tw - 16);
        top = Math.max(16, Math.min(t - estTooltipH - gap, vh - estTooltipH - 16));
        arrow = {
          display: 'block',
          position: 'absolute',
          left: '50%',
          bottom: -8,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid var(--card)',
        };
      }

      setTooltipStyle({ position: 'fixed', left, top, width: tw, zIndex: 250 });
      setArrowStyle(arrow);
    };

    runMeasure();
    const id = window.setTimeout(runMeasure, 120);
    return () => window.clearTimeout(id);
  }, [open, step, layoutKey, onPrepareStep]);

  const finish = () => onClose({ neverAgain });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[239] pointer-events-none overflow-visible"
          style={{ overflow: 'visible' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden={false}
        >
          {rect && !missingTarget && <SpotlightMask rect={rect} />}

          {rect && !missingTarget && (
            <div
              className="fixed z-[242] pointer-events-auto"
              style={{
                top: Math.max(0, rect.top - PAD),
                left: Math.max(0, rect.left - PAD),
                width: rect.width + 2 * PAD,
                height: rect.height + 2 * PAD,
              }}
              aria-hidden
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <div
            className="fixed inset-0 z-[238] bg-black/70 pointer-events-auto"
            style={{ display: rect && !missingTarget ? 'none' : 'block' }}
            onClick={(e) => e.stopPropagation()}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            className="terminal-card relative rounded-xl border p-5 shadow-2xl pointer-events-auto !overflow-visible"
            style={{
              ...tooltipStyle,
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              overflow: 'visible',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={arrowStyle} aria-hidden />

            <p
              className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-2"
              style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}
            >
              User guide · {step + 1} / {STEPS.length}
            </p>
            <h2 id="tour-step-title" className="text-base font-bold mb-2 pr-6 text-[var(--text)]">
              {current.title}
            </h2>
            <p className="text-sm leading-relaxed text-gray-500 mb-4">{current.body}</p>

            {missingTarget && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                This panel is not visible right now. Switch tab or scroll, or skip this step.
              </p>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 select-none mb-3">
              <input
                type="checkbox"
                checked={neverAgain}
                onChange={(e) => setNeverAgain(e.target.checked)}
                className="rounded border-gray-400"
              />
              Don't show guide on next visit (this browser)
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={finish}
                className="text-xs font-medium px-2 py-1.5 rounded-md text-gray-500 hover:text-[var(--text)]"
              >
                Skip guide
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="text-xs font-semibold px-3 py-2 rounded-md border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    Back
                  </button>
                )}
                {!last ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="text-xs font-semibold px-3 py-2 rounded-md text-white bg-[var(--color-brand-primary)]"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finish}
                    className="text-xs font-semibold px-3 py-2 rounded-md text-white bg-[var(--color-brand-primary)]"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
