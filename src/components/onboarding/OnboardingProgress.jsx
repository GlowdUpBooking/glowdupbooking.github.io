import { useMemo } from "react";

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "services", label: "Services" },
  { id: "payouts", label: "Payouts" },
];

export default function OnboardingProgress({ active = "profile", autosaveStatus = "" }) {
  const activeIndex = useMemo(() => STEPS.findIndex((s) => s.id === active), [active]);

  return (
    <div className="obProgressWrap">
      <div className="obProgressTop">
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          return (
            <div className={`obStep obStep-${state}`} key={step.id}>
              <span className="obStepDot" aria-hidden="true" />
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div
        className="obProgressBar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={Math.max(1, activeIndex + 1)}
      >
        <div className="obProgressFill" style={{ width: `${((Math.max(1, activeIndex + 1)) / STEPS.length) * 100}%` }} />
      </div>

      <div className="obStatusRow">
        <span className="obStatusLabel">Autosave</span>
        <span className="obStatusText">{autosaveStatus || "Waiting for changes"}</span>
      </div>
    </div>
  );
}
