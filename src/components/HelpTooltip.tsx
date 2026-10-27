import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Accessible contextual help for dashboard concepts and controls. */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ label, children, className = '' }) => (
  <span className={`group/help relative inline-flex shrink-0 align-middle ${className}`}>
    <button
      type="button"
      aria-label={`Help: ${label}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-xs font-normal leading-5 text-slate-100 shadow-2xl group-hover/help:block group-focus-within/help:block"
    >
      <strong className="mb-1 block text-[11px] uppercase tracking-wide text-emerald-300">{label}</strong>
      {children}
      <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-slate-700 bg-slate-950" />
    </span>
  </span>
);

export const HelpHeading: React.FC<HelpTooltipProps & { heading: React.ReactNode }> = ({ heading, ...help }) => (
  <span className="inline-flex items-center gap-1.5">
    <span>{heading}</span>
    <HelpTooltip {...help} />
  </span>
);
