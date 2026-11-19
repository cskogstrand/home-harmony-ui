import { useRevealSelection } from "@/hooks/use-reveal-selection";
import type { ReactNode } from "react";

type Filter = { id: string; label: string; avatar?: ReactNode };

export function AvatarFilters({ label, options, selected, onSelect }: {
  label: string; options: Filter[]; selected: string; onSelect: (id: string) => void;
}) {
  const filters = useRevealSelection<HTMLDivElement>(selected, options.length);
  return <div ref={filters} className="filter-row avatar-filters" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.id} className={option.avatar ? "avatar-filter" : undefined}
      aria-label={option.label} aria-pressed={selected === option.id} onClick={() => onSelect(option.id)}>
      {option.avatar}<span>{option.label}</span>
    </button>)}
  </div>;
}
