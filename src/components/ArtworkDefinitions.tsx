import sprite from "@/assets/artwork.svg?raw";

export default function ArtworkDefinitions() {
  // Same-document SVG references let gradients and patterns inherit the live palette.
  return <div className="absolute size-0 overflow-hidden pointer-events-none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sprite }} />;
}
