import type { ReactNode } from "react";

type Filter = { id: string; label: string; avatar?: ReactNode };

export function AvatarFilters({ label, options, selected, onSelect }: {
  label: string; options: Filter[]; selected: string; onSelect: (id: string) => void;
}) {
  return <div className="filter-row avatar-filters" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.id} className={option.avatar ? "avatar-filter" : undefined}
      aria-label={option.label} aria-pressed={selected === option.id} onClick={() => onSelect(option.id)}>
      {option.avatar}<span>{option.label}</span>
    </button>)}
  </div>;
}
