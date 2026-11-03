import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function PageContent({ active = true, children }: { active?: boolean; children?: ReactNode }) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!active) return;
    const section = hash && document.getElementById(hash.slice(1));
    if (section) section.scrollIntoView?.(); else window.scrollTo?.(0, 0);
  }, [active, pathname, hash]);
  return children;
}
