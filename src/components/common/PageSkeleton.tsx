import { useLocation } from "react-router-dom";
import { useI18n } from "@/hooks/use-i18n";
import { mainPagePath } from "@/lib/navigation";

// Titles match each main page's own heading so the page settles in place when it arrives.
const titles = { "/": "Today", "/calendar": "Calendar", "/lists": "Lists", "/school": "School", "/home": "Smart home" } as const;
type MainPath = keyof typeof titles;

const Bar = ({ width, height = "1rem" }: { width: string; height?: string }) => <span className="skeleton-bar" style={{ width, height }} />;
const Panel = ({ rows = 3, className = "", height }: { rows?: number; className?: string; height?: string }) =>
  <div aria-hidden="true" className={`glow-panel skeleton-panel ${className}`} style={height ? { minHeight: height } : undefined}>
    <Bar width="38%" height="1.375rem" />
    {Array.from({ length: rows }, (_, index) => <Bar key={index} width={`${88 - index * 14}%`} />)}
  </div>;

// Rough outlines of each page's first screen; other pages get a heading and two panels.
function Shape({ path }: { path?: MainPath }) {
  if (path === "/") return <>
    <Panel rows={2} className="skeleton-wide" />
    <Panel rows={4} height="18rem" />
    <Panel rows={4} height="18rem" />
  </>;
  if (path === "/calendar" || path === "/school") return <>
    <Panel rows={0} className="skeleton-toolbar" />
    <Panel rows={6} height={path === "/calendar" ? "28rem" : "24rem"} />
  </>;
  if (path === "/lists") return <div className="skeleton-columns"><Panel rows={5} /><Panel rows={5} /></div>;
  if (path === "/home") return <div className="skeleton-tiles">{Array.from({ length: 6 }, (_, index) => <Panel key={index} rows={1} />)}</div>;
  return <><Panel rows={3} /><Panel rows={3} /></>;
}

/** Page-shaped placeholder while a page's code downloads: the title in place and quiet blocks where its panels will be. */
export function PageSkeleton({ page }: { page?: string }) {
  const { t, message } = useI18n();
  const { pathname } = useLocation();
  const path = mainPagePath(page ?? pathname) as MainPath | undefined;
  const title = path && message(titles[path]);
  const today = path === "/";
  return <div className={`page-skeleton ${today ? "portrait-board" : "planner-page"}`} aria-busy="true">
    <p role="status" className="sr-only">{t("Loading…")}</p>
    <div aria-hidden="true" className={today ? "ambient-heading" : "page-heading"}>
      <div className={today ? "greeting" : undefined}>
        {title ? <p className="skeleton-title">{title}</p> : <Bar width="12rem" height="2.25rem" />}
        {today && <Bar width="14rem" />}
      </div>
      {today && <Bar width="9rem" height="4rem" />}
    </div>
    <Shape path={path} />
  </div>;
}
