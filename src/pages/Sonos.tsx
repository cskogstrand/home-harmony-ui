import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AudioLines, Check, Speaker } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import { sonosDestinations, sonosPlayers } from "@/lib/sonos";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { SonosSession } from "@/components/sonos/SonosSession";
import "./sonos.css";

export default function Sonos() {
  const { currentHome, homeOnline, connectionStatus } = useApp();
  const { message: t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const players = sonosPlayers(currentHome.entities);
  const selected = players.find(player => player.entityId === params.get("player")) ?? players.find(player => player.state === "playing") ?? players.find(available) ?? players[0];
  const destinations = sonosDestinations(players);
  const selectPlayer = (id: string) => setParams({ player: id }, { replace: true });
  useEffect(() => { if (selected && !params.get("player")) setParams({ player: selected.entityId }, { replace: true }); }, [selected, params, setParams]);
  return <div className="sonos-page">
    <PageHeading title="Sonos" />
    {!players.length ? <section className="glow-panel sonos-empty"><Speaker size={36} aria-hidden="true" />
      <h2>{t(homeOnline ? "Bring your rooms to life" : "Waiting for your speakers")}</h2>
      <p>{t(homeOnline ? "Add the Sonos integration in Home Assistant. Your speakers and favorites will appear here automatically." : ["connecting", "syncing"].includes(connectionStatus) ? "Connecting to Home Assistant…" : "Connect to Home Assistant to see and control your Sonos speakers.")}</p>
      <Button asChild variant="outline"><Link to="/integrations">{t("Integrations")}</Link></Button>
    </section> : <>
      <section id="sonos-rooms" tabIndex={-1} className="sonos-destination-section" aria-label={t("Choose a speaker")}>
        <div className="sonos-destinations" role="group" aria-label={t("Rooms")}>
          {destinations.map(({ player, members }) => <button type="button" key={player.entityId} aria-pressed={members.some(member => member.entityId === selected.entityId)} onClick={() => selectPlayer(player.entityId)}>
            {player.state === "playing" ? <AudioLines size={20} aria-hidden="true" /> : <Speaker size={20} aria-hidden="true" />}
            <span><strong>{members.map(member => member.name).join(" + ")}</strong><small>{entityStateLabel(player, language)}{available(player) && typeof player.attributes.media_title === "string" ? ` · ${player.attributes.media_title}` : ""}</small></span>
            {members.some(member => member.entityId === selected.entityId) && <Check size={18} aria-hidden="true" />}
          </button>)}
        </div>
      </section>
      <SonosSession selected={selected} players={players} selectPlayer={selectPlayer} />
    </>}
  </div>;
}
