import { useEffect, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import type { AssistAgent } from "@/lib/home-assistant";
import { Switch } from "./ui/switch";
import { PanelHeading } from "./FamilyPlanner";

const builtIn = new Set(["conversation.home_assistant", "homeassistant"]);

/** Ask the house: the owner turns it on and picks the conversation agent. What Assist may control is set in Home Assistant. */
export function AssistSettings() {
  const { t, message } = useI18n();
  const homeOnline = useApp(app => app.homeOnline);
  const assistAgents = useApp(app => app.assistAgents);
  const { assist, setAssist, language } = useFamily();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const [agents, setAgents] = useState<{ language: string; list?: AssistAgent[]; error?: string }>();
  useEffect(() => {
    if (!homeOnline) return;
    let current = true;
    assistAgents(language).then(list => { if (current) setAgents({ language, list }); },
      (error: Error) => { if (current) setAgents({ language, error: error.message }); });
    return () => { current = false; };
  }, [assistAgents, homeOnline, language]);
  const loaded = agents?.language === language ? agents : undefined;
  // The built-in agent is what Home Assistant uses without an agent ID, so it is the empty choice.
  const list = (loaded?.list ?? []).filter(agent => !builtIn.has(agent.id));
  const missing = assist.agentId && !list.some(agent => agent.id === assist.agentId);
  const status = !homeOnline ? t("Connect to Home Assistant to list its conversation agents.")
    : !loaded ? t("Loading conversation agents…") : loaded.error ? message(loaded.error) : "";
  return <section className="settings-stack">
    <section className="settings-card settings-preferences">
      <PanelHeading icon={MessageCircleQuestion} title={t("Ask the house")} />
      <p className="page-note">{t("Ask Home Assistant a question or give it a command from the header, on every screen. Assist can only see and control what you have exposed to it in Home Assistant.")}</p>
      <label className="settings-control-row">
        <span>{t("Show Ask the house")}<span className="page-note block" id="assist-enabled-description">{t("Adds a button to the header on every connected screen.")}</span></span>
        <Switch aria-label={t("Show Ask the house")} aria-describedby="assist-enabled-description" disabled={disabled}
          checked={assist.enabled} onCheckedChange={enabled => setAssist({ enabled })} />
      </label>
      <div className="planner-form"><label>{t("Conversation agent")}
        <select value={assist.agentId} disabled={disabled} aria-describedby={status ? "assist-agent-status" : undefined}
          onChange={event => setAssist({ agentId: event.target.value })}>
          <option value="">{t("Home Assistant (built-in)")}</option>
          {list.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          {missing && <option value={assist.agentId}>{loaded?.list ? t("Selected agent unavailable") : assist.agentId}</option>}
        </select>
      </label></div>
      {status && <p className="page-note" id="assist-agent-status" role={loaded?.error ? "alert" : "status"}>{status}</p>}
    </section>
  </section>;
}
