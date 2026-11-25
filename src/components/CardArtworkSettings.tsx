import { Paintbrush } from "lucide-react";
import { PanelTitle } from "./PanelTitle";
import { plannerArtworkSchema, type PlannerArtwork } from "../../shared/configuration";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import type { MessageKey } from "@/lib/i18n";
import { smartHomeCards } from "@/lib/smart-home-cards";
import { CardBackdrop, DeviceIllustration, PlannerIllustration } from "./CardArtwork";
import { Switch } from "./ui/switch";

const plannerNames: Record<PlannerArtwork, MessageKey> = {
  morningSummary: "Morning summary", wasteCollection: "Waste collection", nextPlan: "Next family plan",
  day: "Everyone’s day", week: "Everyone’s week", daily: "Daily rhythm", shopping: "Shopping",
  homework: "Homework", school: "Timetables", home: "Home favorites", recentActivity: "Latest events", homeStatus: "Home status",
  calendar: "Calendar", tasks: "Family tasks",
};

export function CardArtworkSettings({ disabled }: { disabled: boolean }) {
  const { t, message } = useI18n();
  const { appearance, smartHome, setAppearance, setSmartHomeCardArtwork } = useFamily();
  const { currentHome } = useApp();
  const cards = smartHomeCards(currentHome.entities, smartHome);
  return <section className="settings-card card-artwork-settings">
    <PanelTitle icon={Paintbrush}>{t("Card artwork")}</PanelTitle>
    <p className="page-note">{t("Choose which cards show corner artwork and an illustrated icon. This also works without a wall background.")}</p>
    <fieldset><legend>{t("Planner cards")}</legend>
      <div className="card-artwork-options">
        {plannerArtworkSchema.options.map(kind => <label key={kind}>
          {appearance.plannerArtwork[kind] && <CardBackdrop kind={kind} />}
          <PlannerIllustration kind={kind} /><span>{t(plannerNames[kind])}</span>
          <Switch disabled={disabled} checked={!!appearance.plannerArtwork[kind]}
            onCheckedChange={checked => setAppearance({ plannerArtwork: { ...appearance.plannerArtwork, [kind]: checked } })} />
        </label>)}
      </div>
    </fieldset>
    <details><summary>{t("Smart home cards")} <span>({cards.length})</span></summary>
      {cards.length ? <div className="card-artwork-options">
        {cards.map((card, index) => <label key={card.id}>
          {card.illustrated && <CardBackdrop kind="device" />}
          <DeviceIllustration icon={card.design.icon} />
          <span>{card.title || card.main?.name || message(card.design.subtitle)}
            <small>{[card.group, t("Card {position} of {total}", { position: index + 1, total: cards.length })].filter(Boolean).join(" · ")}</small>
          </span>
          <Switch disabled={disabled} checked={!!card.illustrated} onCheckedChange={checked => setSmartHomeCardArtwork(card.id, checked)} />
        </label>)}
      </div> : <p className="page-note">{t("Add a card in Smart home to give it corner artwork and an illustrated icon.")}</p>}
    </details>
  </section>;
}
