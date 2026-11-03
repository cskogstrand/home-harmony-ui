import { lazy, startTransition, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Route, Routes, useLocation, type Location } from "react-router-dom";
import { PageActivityContext } from "@/contexts/PageActivityContext";
import { useI18n } from "@/hooks/use-i18n";
import { PageErrorBoundary } from "@/components/common/PageErrorBoundary";
import { PageContent } from "@/components/common/PageContent";
import { mainPagePath } from "@/lib/navigation";

const pages = {
  "/": lazy(() => import("@/pages/Dashboard")),
  "/calendar": lazy(() => import("@/pages/Calendar")),
  "/lists": lazy(() => import("@/pages/Lists")),
  "/school": lazy(() => import("@/pages/School")),
  "/home": lazy(() => import("@/pages/SmartHome")),
};

export function MainPages({ locations, errorFallback }: { locations: Record<string, Location>; errorFallback: ReactNode }) {
  const { pathname } = useLocation();
  const activePath = mainPagePath(pathname);
  const { t } = useI18n();
  const [preload, setPreload] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => startTransition(() => setPreload(true)), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return Object.entries(pages).map(([path, Page]) => (preload || locations[path] || path === activePath) &&
    <RetainedPage key={path} active={path === activePath}>
      <PageErrorBoundary fallback={errorFallback}>
        <Suspense fallback={<p role="status">{t("Loading…")}</p>}>
          <PageContent active={path === activePath}>
            <Routes location={locations[path] ?? path}><Route path={path} element={<Page />} /></Routes>
          </PageContent>
        </Suspense>
      </PageErrorBoundary>
    </RetainedPage>);
}

function RetainedPage({ active, children }: { active: boolean; children: ReactNode }) {
  const mount = useRef<HTMLDivElement>(null);
  const [container] = useState(() => {
    const node = document.createElement("div");
    node.style.display = "contents";
    return node;
  });
  useLayoutEffect(() => {
    // Detach only the DOM: subscriptions and component state survive navigation.
    if (active) mount.current?.appendChild(container);
    return () => container.remove();
  }, [active, container]);
  return <PageActivityContext.Provider value={active}>
    <div ref={mount} style={{ display: "contents" }} />
    {createPortal(children, container)}
  </PageActivityContext.Provider>;
}
