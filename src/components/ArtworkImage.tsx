import type { Artwork } from "../../shared/configuration";

export function ArtworkImage({ artwork, className }: { artwork: Exclude<Artwork, "none">; className: string }) {
  return <svg className={className} data-scene={artwork} viewBox="0 0 1440 580" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <use href={`#artwork-${artwork}`} />
  </svg>;
}
