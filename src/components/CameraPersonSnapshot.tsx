import { useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { useCameraPersonImage } from "@/contexts/CameraPersonImageContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Check, ChevronLeft, CircleAlert, EyeOff, UserRound } from "lucide-react";
import { CameraMediaStatus } from "./CameraMediaStatus";
import { cameraPersonPipWidths } from "../../shared/cameras";

const corners = { "top-left": "Top left", "top-right": "Top right", "bottom-left": "Bottom left", "bottom-right": "Bottom right" } as const;
type Corner = keyof typeof corners;
type Edge = "left" | "right";

export function CameraPersonSnapshot({ cameraId, overlay = false }: { cameraId: string; overlay?: boolean }) {
  const { message: t } = useI18n();
  const hintId = useId();
  const reducedMotion = useReducedMotion();
  const inset = useRef<HTMLButtonElement>(null), restore = useRef<HTMLButtonElement>(null);
  const position = useRef<HTMLDivElement>(null);
  const animation = useRef<ReturnType<typeof animate>>(null);
  const previousRect = useRef<DOMRect>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; rect: DOMRect; offsetX: number; offsetY: number; moved: boolean }>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ corner: Corner; edge?: Edge; immediate?: boolean }>({ corner: "top-right" });
  const hidden = !!placement.edge;
  useLayoutEffect(() => {
    const button = inset.current, element = position.current;
    if (!button || !element) return;
    animation.current?.stop();
    element.style.transition = "none";
    element.style.translate = "";
    element.style.transform = "none";
    element.style.opacity = "1";
    const rect = element.getBoundingClientRect();
    element.style.removeProperty("transition");
    const from = previousRect.current;
    previousRect.current = null;
    if (from && !placement.immediate) animation.current = reducedMotion
      ? animate(element, { opacity: [.8, 1] }, { duration: .16 })
      : animate(element, { transform: [`translate(${from.left - rect.left}px, ${from.top - rect.top}px)`, "translate(0px, 0px)"] }, { type: "spring", duration: .5, bounce: .2 });
    if (hidden) restore.current?.focus({ preventScroll: true });
    else if (from) button.focus({ preventScroll: true });
    return () => animation.current?.stop();
  }, [placement, hidden, reducedMotion]);
  const place = (corner: Corner, edge?: Edge, immediate = false) => {
    previousRect.current = position.current?.getBoundingClientRect();
    setOpen(false);
    setPlacement({ corner, edge, immediate });
  };
  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag.current) return;
    const button = event.currentTarget, element = position.current, rect = element.getBoundingClientRect(), bounds = element.parentElement.getBoundingClientRect();
    animation.current?.stop();
    const offsetX = rect.left - bounds.left - element.offsetLeft, offsetY = rect.top - bounds.top - element.offsetTop;
    // Fold any in-flight timeline lift into the drag so the picture stays under the pointer.
    element.style.transition = "none";
    element.style.translate = "none";
    element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    element.style.opacity = "1";
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rect, offsetX, offsetY, moved: false };
    button.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const x = event.clientX - current.x, y = event.clientY - current.y;
    if (!current.moved && Math.hypot(x, y) < 6) return;
    current.moved = true;
    suppressClick.current = true;
    setOpen(false);
    event.currentTarget.dataset.dragging = "true";
    position.current.style.transform = `translate(${current.offsetX + x}px, ${current.offsetY + y}px)`;
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled || !current.moved) { place(placement.corner); return; }
    const bounds = position.current.parentElement.getBoundingClientRect();
    const x = current.rect.left + current.rect.width / 2 + event.clientX - current.x;
    const y = current.rect.top + current.rect.height / 2 + event.clientY - current.y;
    const corner: Corner = `${y < bounds.top + bounds.height / 2 ? "top" : "bottom"}-${x < bounds.left + bounds.width / 2 ? "left" : "right"}`;
    const outside = x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
    const edge = outside ? corner.endsWith("left") ? "left" : "right" : undefined;
    place(corner, edge);
  };
  const shared = useSharedConfiguration();
  const camera = shared?.state.config.settings.cameras?.items.find(camera => camera.id === cameraId);
  const source = camera?.personSnapshot;
  const image = useCameraPersonImage(cameraId);
  const configured = source && source.type !== "none";
  const retry = configured && image?.failed && <Button type="button" variant="outline" onClick={image.refresh}>{t("Retry")}</Button>;
  const status = !configured ? "Choose a person snapshot in Camera settings."
    : image?.failed ? image.src ? "Could not update the person snapshot. Showing the previous image." : "Person snapshot unavailable. Check the source in Camera settings."
    : !image?.src ? "Loading image…" : "Latest person snapshot · may predate this alert";
  if (overlay) return <div ref={position} className="smart-person-inset" data-corner={placement.corner} data-edge={placement.edge} style={{
      width: `${cameraPersonPipWidths[camera?.personPipSize ?? "medium"]}%`,
      // Reserve the inset's margins and border before fitting tall images inside the video.
      maxWidth: image?.width && image.height ? `calc((var(--camera-image-height) - 1rem - 4px - var(--camera-person-clearance, 0px)) * ${image.width / image.height} + 4px)` : undefined,
    }}>
    <span id={hintId} className="sr-only">{t("Drag to a corner, or swipe out of the video to hide. Tap for more options.")}</span>
    <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button ref={inset} type="button" className="smart-person-pip" data-corner={placement.corner} data-size={camera?.personPipSize ?? "medium"}
      aria-label={t("Latest person snapshot")} aria-describedby={hintId} aria-hidden={hidden || undefined} disabled={hidden} tabIndex={hidden ? -1 : 0} title={t(status)}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={event => endDrag(event, true)} onLostPointerCapture={event => endDrag(event, true)}
      onClick={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); suppressClick.current = false; } }}>
      {configured && image?.src ? <img src={image.src} width={image.width} height={image.height} draggable={false} alt={t("Latest person snapshot")} /> : <UserRound size={24} aria-hidden="true" />}
      {image?.failed && <CircleAlert className="smart-person-pip-error" size={18} aria-hidden="true" />}
    </button></PopoverTrigger>
    <PopoverContent side="bottom" align="end" className="space-y-3 text-sm" aria-label={t("Latest person snapshot")}
      onCloseAutoFocus={event => { event.preventDefault(); (hidden ? restore : inset).current?.focus({ preventScroll: true }); }}>
      <p role="status">{t(status)}</p>
      {retry}
      <p>{t("Drag to a corner, or swipe out of the video to hide. Tap for more options.")}</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("Person image position")}>
        {Object.entries(corners).map(([corner, label]) => <Button key={corner} variant="outline" className="whitespace-normal" aria-pressed={placement.corner === corner}
          onClick={event => place(corner as Corner, undefined, event.detail === 0)}><Check aria-hidden="true" className={placement.corner === corner ? "" : "invisible"} />{t(label)}</Button>)}
      </div>
      <Button variant="outline" className="w-full" onClick={event => place(placement.corner, placement.corner.endsWith("left") ? "left" : "right", event.detail === 0)}><EyeOff aria-hidden="true" />{t("Hide person snapshot")}</Button>
    </PopoverContent>
  </Popover>
    {hidden && <Button ref={restore} type="button" variant="ghost" className="smart-person-restore glass-surface" data-edge={placement.edge}
      aria-label={t("Show person snapshot")} title={t("Show person snapshot")} onClick={event => place(placement.corner, undefined, event.detail === 0)}>
      <ChevronLeft aria-hidden="true" />
    </Button>}
  </div>;
  return <div className="smart-entity-media is-camera">
    {configured && image?.src ? <>
      <img src={image.src} alt={t("Latest person snapshot")} />
      <CameraMediaStatus label={status} icon={image.failed ? CircleAlert : UserRound}>{retry}</CameraMediaStatus>
    </> : <><p role="status">{t(status)}</p>{retry}</>}
  </div>;
}
