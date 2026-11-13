import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { AudioLines, ChevronDown, Speaker, Timer } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { sonosDestinations, sonosPlayers } from "@/lib/sonos";
import { SonosSession } from "./SonosSession";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SonosMiniPlayer() {
  const { currentHome, homeOnline } = useApp();
  const { message: t } = useI18n();
  const { pathname } = useLocation();
  const [selectedId, setSelectedId] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const players = sonosPlayers(currentHome.entities);
  const destinations = sonosDestinations(players).filter(({ coordinator, members }) => coordinator
    && coordinator.attributes.source !== "TV" && (["playing", "paused"].includes(coordinator.state)
      || coordinator.state === "idle" && members.some(member => member.entityId === selectedId)));
  const playing = destinations.filter(({ player }) => player.state === "playing");
  const destination = destinations.find(({ members }) => members.some(member => member.entityId === selectedId)) ?? playing[0];
  const selected = destination?.members.find(member => member.entityId === selectedId) ?? destination?.player;
  // Only a playing group summons the mini; retain the current room during the dismissal countdown.
  useEffect(() => { setSelectedId(selected?.entityId); }, [selected?.entityId]);
  const settings = /^\/(settings(?:\/|$)|user-settings(?:\/|$)|onboarding(?:\/|$))/i.test(pathname);
  const visible = !settings && homeOnline && !!selected;
  useEffect(() => { if (!visible) setExpanded(false); }, [visible]);
  const countingDown = !!selected && playing.length === 0 && !expanded;
  useEffect(() => {
    setSeconds(10);
    if (!countingDown) return;
    const deadline = Date.now() + 10_000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) setSelectedId(undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countingDown]);
  const roomPicker = <div className="sonos-mini-rooms">
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" className="sonos-mini-room-trigger" aria-label={t("Choose a speaker")}>
        <Speaker size={15} aria-hidden="true" /><span>{destination?.members.map(member => member.name).join(" + ")}</span><ChevronDown size={14} aria-hidden="true" />
      </Button></DropdownMenuTrigger>
      <DropdownMenuContent className="sonos-room-menu" side="top" align="start">
        <DropdownMenuLabel>{t(playing.length > 1 ? "{count} groups playing separately" : "Choose a speaker", { count: playing.length })}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={destination?.player.entityId} onValueChange={setSelectedId}>
          {destinations.map(({ player, members }) => <DropdownMenuRadioItem key={player.entityId} value={player.entityId}>
            <span><strong>{members.map(member => member.name).join(" + ")}</strong><small>{t(player.state === "playing" ? "Playing" : player.state === "paused" ? "Paused" : "Stopped")} · {typeof player.attributes.media_title === "string" ? player.attributes.media_title : t("Now playing")}</small></span>
          </DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    {playing.length > 1 && <span className="sonos-mini-count" title={t("{count} groups playing separately", { count: playing.length })}><AudioLines size={15} aria-hidden="true" />{t("{count} playing separately", { count: playing.length })}</span>}
    {countingDown && <span className="sonos-mini-count tabular-nums" role="timer" aria-live="off"><Timer size={15} aria-hidden="true" />{t("Hides in {seconds} s", { seconds })}</span>}
  </div>;
  return <AnimatePresence initial={false}>{visible && <MiniPresence key="sonos-mini">
    <SonosSession selected={selected} players={players} selectPlayer={setSelectedId} roomPicker={roomPicker} expanded={expanded} onExpandedChange={setExpanded} />
  </MiniPresence>}</AnimatePresence>;
}

function MiniPresence({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const keyboard = document.documentElement.dataset.motionInput === "keyboard";
  return <motion.div className="sonos-mini-presence" ref={element => { if (element) element.inert = !present; }} aria-hidden={!present || undefined}
    initial={{ opacity: 0, transform: reduced || keyboard ? "none" : "translateY(16px)" }}
    animate={{ opacity: 1, transform: "none" }} exit={{ opacity: 0, transform: reduced || keyboard ? "none" : "translateY(16px)" }}
    transition={{ duration: keyboard ? 0 : reduced ? .16 : .24, ease: [.23, 1, .32, 1] }}>{children}</motion.div>;
}
