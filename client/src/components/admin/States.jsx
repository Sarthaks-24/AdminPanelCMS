import React from 'react';
import { Inbox } from 'lucide-react';

// Placeholder rows shaped like list items, so the page doesn't jump when data arrives.
export function ListSkeleton({ rows = 4, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton h-[4.5rem] w-full" style={{ animationDelay: `${index * 80}ms` }} />)}
    </div>
  );
}

// A composed empty state: say what is missing and what to do next.
export function EmptyState({ title, hint, icon: Icon = Inbox }) {
  return (
    <div className="rounded-2xl border border-dashed border-t-border-hi bg-t-surface/60 px-6 py-14 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-t-border bg-t-bg text-t-accent"><Icon size={20} /></span>
      <h3 className="mt-4 text-sm font-semibold text-t-text">{title}</h3>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-t-muted">{hint}</p>}
    </div>
  );
}
