import { useLayoutEffect, useRef, useState } from "react";
import { control, divIcon, map, marker, tileLayer, type LatLngTuple, type Map, type Marker } from "leaflet";
import { Maximize2 } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import "leaflet/dist/leaflet.css";

export default function VehicleMap({ lat, lon }: { lat: number; lon: number }) {
  const { t } = useI18n();
  const inline = useRef<HTMLDivElement>(null);
  const [fullscreenHost, setFullscreenHost] = useState<HTMLDivElement | null>(null);
  const [container] = useState(() => document.createElement("div"));
  const initialPosition = useRef<LatLngTuple>([lat, lon]);
  const live = useRef<{ view: Map; pin: Marker }>();

  // Move the same map between the two sizes so its zoom and loaded tiles survive.
  useLayoutEffect(() => {
    (fullscreenHost ?? inline.current).append(container);
    live.current?.view.invalidateSize();
  }, [container, fullscreenHost]);

  useLayoutEffect(() => {
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", t("Vehicle position on OpenStreetMap"));
    const view = map(container, { zoomControl: false }).setView(initialPosition.current, 14);
    control.zoom({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") }).addTo(view);
    view.attributionControl.setPrefix(false);
    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin",
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(view);
    const pin = marker(initialPosition.current, {
      icon: divIcon({ className: "vehicle-map-pin", iconSize: [18, 18] }),
      interactive: false, keyboard: false,
    }).addTo(view);
    live.current = { view, pin };
    const resize = new ResizeObserver(() => view.invalidateSize());
    resize.observe(container);
    return () => {
      resize.disconnect();
      view.remove();
      live.current = undefined;
    };
  }, [container, t]);

  useLayoutEffect(() => {
    const { view, pin } = live.current;
    const position: LatLngTuple = [lat, lon];
    if (pin.getLatLng().equals(position, 0)) return;
    pin.setLatLng(position);
    view.panTo(position, { animate: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : undefined });
  }, [lat, lon, t]);

  return <Dialog>
    <div ref={inline} className="vehicle-map-host" />
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="icon" className="vehicle-map-expand"
        title={t("Show map fullscreen")} aria-label={t("Show map fullscreen")}><Maximize2 aria-hidden="true" /></Button>
    </DialogTrigger>
    <DialogContent className="vehicle-map-fullscreen" aria-describedby={undefined}>
      <DialogTitle className="sr-only">{t("Vehicle position on OpenStreetMap")}</DialogTitle>
      <div ref={setFullscreenHost} className="vehicle-map-host" />
    </DialogContent>
  </Dialog>;
}
