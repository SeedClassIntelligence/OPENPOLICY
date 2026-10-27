import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';

export interface GuidedTourStep {
  targetId: string;
  eyebrow: string;
  title: string;
  description: string;
}

interface GuidedTourProps {
  steps: GuidedTourStep[];
  activeStep: number;
  onStepChange: (step: number) => void;
  onClose: (completed: boolean) => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, activeStep, onStepChange, onClose }) => {
  const step = steps[activeStep];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const target = document.getElementById(step.targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-4', 'ring-emerald-400', 'ring-offset-4', 'relative', 'z-30');
    }, 120);

    return () => {
      window.clearTimeout(timer);
      const target = document.getElementById(step.targetId);
      target?.classList.remove('ring-4', 'ring-emerald-400', 'ring-offset-4', 'relative', 'z-30');
    };
  }, [step.targetId]);

  const last = activeStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none" aria-live="polite">
      <div className="absolute inset-0 bg-slate-950/25" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-tour-title"
        className="pointer-events-auto absolute bottom-5 right-5 left-5 sm:left-auto sm:w-[420px] bg-slate-950 text-white rounded-2xl border border-emerald-400/40 shadow-2xl overflow-hidden"
      >
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Compass className="w-4 h-4" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em]">{step.eyebrow}</span>
            </div>
            <button type="button" onClick={() => onClose(false)} className="text-slate-400 hover:text-white" aria-label="Exit guided tour">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 id="provider-tour-title" className="mt-3 text-xl font-bold">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-500">{activeStep + 1} of {steps.length}</span>
            <div className="flex gap-2">
              {activeStep > 0 && (
                <button type="button" onClick={() => onStepChange(activeStep - 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <button type="button" onClick={() => last ? onClose(true) : onStepChange(activeStep + 1)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300">
                {last ? <><Check className="w-3.5 h-3.5" /> Finish</> : <>Next <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
