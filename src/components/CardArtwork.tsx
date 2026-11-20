import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArtworkImage } from "./ArtworkImage";
import type { Artwork, PlannerArtwork } from "../../shared/configuration";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";

// Small painted objects share paper, pigment and highlight colors with the wall illustrations.
const paper = "var(--art-snow)", shadow = "var(--art-deep)", pigment = "var(--art-mid)";
const highlight = "var(--art-warm)", line = "var(--art-action)";
const drawings: Record<PlannerArtwork, ReactNode> = {
  homework: <>
    <path fill={shadow} d="m8 21 26-6 7 4 26 1-7 28-24 1-7-3-23 1z" />
    <path fill={paper} d="m10 18 23-5 8 5-6 27-7-4-21 2z" />
    <path fill={pigment} d="m41 18 25-1-7 26-24 2z" />
    <path stroke={line} d="m15 23 13-3m-14 8 13-3m-14 8 11-2m33-8-12 2m10 4-11 2" />
    <path fill={highlight} d="m43 33 18-25 5 4-18 25-7 4z" /><path fill={shadow} d="m43 33 5 4-7 4z" />
  </>,
  calendar: <>
    <path fill={shadow} d="m13 13 46-4 6 35-46 5z" /><path fill={paper} d="m11 14 44-4 7 32-44 5z" />
    <path fill={pigment} d="m11 14 44-4 2 9-44 4z" /><path stroke={line} strokeWidth="3" d="m22 9 1 7m19-9 1 7" />
    <path stroke={pigment} d="m23 28 28-3m-26 10 27-3m-20-8 3 15m6-16 3 15" />
    <circle cx="44" cy="29" r="4" fill={highlight} />
  </>,
  week: <>
    <path fill={shadow} d="m8 15 20-4 16 6 19-4 3 29-20 5-17-5-18 5z" />
    <path fill={paper} d="m8 12 20-4 3 31-20 5z" /><path fill={pigment} d="m28 8 16 6 3 30-16-5z" />
    <path fill={paper} d="m44 14 19-4 3 29-19 5z" />
    <path stroke={line} d="m13 20 12-3m-11 9 11-2m-11 8 11-3m24-7 11-3m-10 9 10-3m-9 8 9-3" />
    <path fill={highlight} d="m33 10 7 3 1 16-4-4-3 2z" />
  </>,
  day: <>
    <path fill={shadow} d="M11 45V26a24 24 0 0 1 48 0v19z" /><path fill={paper} d="M15 41V27a20 20 0 0 1 40 0v14z" />
    <circle cx="43" cy="22" r="7" fill={highlight} /><path fill={pigment} d="m15 33 10-10 14 13 7-5 9 5v5H15z" />
    <path stroke={line} strokeWidth="2" d="M35 8v33M15 28h40" /><path fill={highlight} d="M8 43h56v4H8z" />
  </>,
  nextPlan: <>
    <path fill={pigment} d="m6 26 31-9 7 25-31 8z" /><path stroke={paper} d="m14 29 16-5m-14 10 12-4" />
    <path fill={shadow} d="m42 8 11-1 1 7-9 1z" /><circle cx="48" cy="29" r="18" fill={shadow} /><circle cx="47" cy="27" r="15" fill={paper} />
    <path stroke={line} strokeWidth="2.5" d="m47 17 0 11 8 4" /><circle cx="47" cy="27" r="2.5" fill={highlight} />
    <path stroke={pigment} d="M47 14v2m13 11h-2m-11 13v-2m-13-11h2" />
  </>,
  morningSummary: <>
    <path fill={pigment} d="m10 16 21-2 3 28-21 2z" /><path fill={paper} d="m14 20 14-1 2 17-14 1z" />
    <path fill={shadow} d="m9 13 22-2 1 5-23 2zm9-6 7-1 1 6-7 1z" /><path stroke={shadow} strokeWidth="3" d="m32 19 5-1 2 13-6 2" />
    <path fill={highlight} d="M34 28h23l-2 11q-2 7-11 7t-10-9z" /><path stroke={line} strokeWidth="3" d="M57 31q10-2 7 5-2 4-9 4" />
    <path stroke={pigment} d="M42 23q-4-4 0-8m7 8q5-5 1-10M29 46h33" />
  </>,
  daily: <>
    <circle cx="47" cy="19" r="11" fill={highlight} /><path stroke={line} d="m47 3 0 3m13 0-3 3m8 9-4 0m-26-9-3-3" />
    <path fill={shadow} d="m11 34 21-6 12 7 17-4 2 13-18 5-14-5-17 4z" /><path fill={paper} d="m10 30 21-5 14 7 16-4 1 12-18 5-13-5-18 4z" />
    <path stroke={pigment} d="m16 34 12-3m6 1 8 4m6 1 8-2" />
    <path stroke={line} strokeWidth="2" d="M23 29q2-11-3-20" /><path fill={pigment} d="M23 21Q8 19 10 10q14 0 13 11zm0-5Q27 3 34 5q0 9-11 11z" />
  </>,
  tasks: <>
    <path fill={pigment} d="m10 15 33-7 5 32-33 8z" /><path fill={shadow} d="m24 10 31 2-3 36-31-2z" />
    <path fill={paper} d="m22 8 31 2-3 35-31-2z" /><path fill={highlight} d="m30 7 13 1 0 6-14-1z" />
    <path stroke={line} strokeWidth="2" d="m26 21 2 2 4-5m3 4 10 1m-20 7 2 3 4-6m3 4 10 1m-20 5 19 2" />
  </>,
  shopping: <>
    <path fill={highlight} d="M26 33 19 12q-2-8 4-9 5-1 8 9l5 19z" /><path stroke={shadow} d="m22 11 4 2m-3 3 5 2" />
    <path fill={pigment} d="M40 31q-8-12-5-20 11 4 11 12 2-13 12-16 1 14-9 24z" />
    <path fill={shadow} d="m9 25 52-2-7 23-36 2z" /><path fill={highlight} d="m12 27 46-2-6 17-33 2z" />
    <path stroke={line} d="m21 28 4 13m5-14 3 14m6-15 1 14m9-14-2 13m-30-5 37-2" /><path stroke={shadow} strokeWidth="3" d="m21 25 11-13 14 12" />
  </>,
  school: <>
    <path fill={shadow} d="m12 17 47-3 4 29-48 4z" /><path stroke={line} strokeWidth="3" d="m26 15 0-5q5-6 14-2l2 6" />
    <path fill={pigment} d="m10 18 45-3 3 26-45 4z" /><path fill={highlight} d="m9 18 47-4 1 12-20 8-24-4z" />
    <path stroke={paper} d="m16 22 35-3m-33 20 34-3" /><path fill={shadow} d="m31 27 8-1 1 10-8 1z" /><path stroke={paper} d="m34 31 3 0" />
  </>,
  wasteCollection: <>
    <path fill={shadow} d="m13 17 31-3-2 30-23 2z" /><path fill={pigment} d="m15 18 25-2-2 24-17 2z" />
    <path stroke={paper} d="m22 21 2 15m6-16 0 15" /><path fill={shadow} d="m10 14 33-3 2 5-35 3zm10-5 10-1 1 4-11 1z" />
    <circle cx="21" cy="46" r="3" fill={line} /><circle cx="39" cy="44" r="3" fill={line} />
    <path fill={highlight} d="M41 38q-2-17 21-22 0 20-21 22z" /><path stroke={line} d="m38 45 19-23" />
  </>,
  home: <>
    <path fill={pigment} d="m6 28 12-12 14 9v18l-25 2z" /><path fill={shadow} d="m24 24 18-17 21 14-3 24-35 3z" />
    <path fill={paper} d="m28 24 14-13 16 11-2 18-27 4z" /><path fill={highlight} d="m22 23 20-19 24 16-4 4-20-13-17 16z" />
    <path fill={pigment} d="m39 27 8-1-1 16-8 1zm12-2 4-1v6l-5 1zm-21 3 5-1-1 6-4 1z" />
  </>,
};

export function PlannerIllustration({ kind }: { kind: PlannerArtwork }) {
  return <svg className="card-illustration" data-illustration={kind} viewBox="0 0 72 54" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <path fill="var(--art-high)" d="M4 31C1 13 18 4 38 5c17-1 30 8 31 22 2 16-12 23-32 24C18 52 6 47 4 31Z" />
    {drawings[kind]}
  </svg>;
}

const cardScenes: Record<PlannerArtwork | "device", Exclude<Artwork, "none">> = {
  day: "fjord", nextPlan: "harbor", morningSummary: "pottery", week: "weave",
  daily: "meadow", shopping: "garden", wasteCollection: "birch", homework: "sunroom",
  school: "atlas", home: "pottery", calendar: "paper", tasks: "weave", device: "weave",
};

export function CardBackdrop({ kind }: { kind: keyof typeof cardScenes }) {
  return <span className="card-backdrop" aria-hidden="true"><ArtworkImage artwork={cardScenes[kind]} className="card-backdrop-image" /></span>;
}

function usePlannerArtwork(kind: PlannerArtwork) {
  return useSharedConfiguration()?.state.config?.settings.appearance?.plannerArtwork?.[kind];
}

export function PlannerCardBackdrop({ kind }: { kind: PlannerArtwork }) {
  return usePlannerArtwork(kind) ? <CardBackdrop kind={kind} /> : null;
}

export function PlannerCardIcon({ kind, children }: { kind: PlannerArtwork; children?: ReactNode }) {
  const enabled = usePlannerArtwork(kind);
  return enabled ? <span className="illustrated-icon"><PlannerIllustration kind={kind} />{children}</span> : <>{children}</>;
}

export function DeviceIllustration({ icon: Icon }: { icon: LucideIcon }) {
  return <svg className="device-illustration" viewBox="0 0 52 48" aria-hidden="true" focusable="false">
    <path fill="var(--art-mist)" d="m4 13 10-8 27 3 7 8-4 23-11 6-23-4-6-9z" />
    <path fill="var(--art-high)" d="m7 13 9-6 23 3 5 6-4 21-9 5-20-4-5-8z" />
    <path fill="none" stroke="var(--art-mid)" d="m9 23 2-9 7-4m12 28 7-3 2-5" />
    <circle cx="39" cy="12" r="3" fill="var(--art-warm)" />
    <Icon x="13" y="10" width="26" height="26" stroke="var(--art-action)" strokeWidth={1.65} />
  </svg>;
}
