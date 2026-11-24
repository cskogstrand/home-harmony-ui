import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, MessageCircleQuestion, RotateCcw, SendHorizontal, Trash2, TriangleAlert } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import type { AssistAnswer } from "@/lib/home-assistant";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import "./assist.css";

type Turn = { id: number; question: string } & ({ status: "pending" } | { status: "answered"; answer: AssistAnswer } | { status: "failed"; error: string });
const MAX_TURNS = 50;

/** "Ask the house": a header button and dialog that send typed sentences to Home Assistant Assist for this session. */
export function AskTheHouse() {
  const { t, message, language } = useI18n();
  const homeOnline = useApp(app => app.homeOnline);
  const assist = useApp(app => app.assist);
  const { assist: settings } = useFamily();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // Follow-ups continue Home Assistant's conversation with the same agent; Clear or another agent starts a new one.
  const conversation = useRef<{ agentId: string; id: string }>();
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const pending = turns.some(turn => turn.status === "pending");
  useEffect(() => { log.current?.lastElementChild?.scrollIntoView?.({ block: "nearest" }); }, [turns, open]);
  if (!settings.enabled) return null;

  const label = homeOnline ? t("Ask the house") : [t("Ask the house"), t("Home Assistant is offline")].join(" · ");
  const update = (id: number, turn: Turn) => setTurns(list => list.map(item => item.id === id ? turn : item));
  async function ask(question: string, replace?: number) {
    const text = question.trim();
    if (!text || pending || !homeOnline) return;
    const id = replace ?? nextId.current++;
    const turn: Turn = { id, question: text, status: "pending" };
    setTurns(list => replace === undefined ? [...list, turn].slice(-MAX_TURNS) : list.map(item => item.id === replace ? turn : item));
    setDraft("");
    const agentId = settings.agentId;
    try {
      const answer = await assist(text, { language, agentId: agentId || undefined,
        conversationId: conversation.current?.agentId === agentId ? conversation.current.id : undefined });
      if (answer.conversationId) conversation.current = { agentId, id: answer.conversationId };
      update(id, { id, question: text, status: "answered", answer });
      // Home Assistant did not understand or could not act: offer the sentence again for editing.
      if (answer.type === "error") setDraft(current => current || text);
    } catch (error) {
      update(id, { id, question: text, status: "failed", error: error instanceof Error ? error.message : "Home Assistant could not handle the question. Check that Assist is set up in Home Assistant, then try again." });
      setDraft(current => current || text);
    }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(draft); };
  const clear = () => { setTurns([]); conversation.current = undefined; input.current?.focus(); };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" className="icon-button glass-surface assist-trigger" aria-label={label} title={label}
        aria-disabled={homeOnline ? undefined : true} onClick={event => { if (!homeOnline && !open) event.preventDefault(); }}>
        <MessageCircleQuestion size={20} aria-hidden="true" />
      </button>
    </DialogTrigger>
    {open && <DialogContent className="assist-dialog" onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}>
      <DialogHeader className="assist-head">
        <DialogTitle className="panel-title"><MessageCircleQuestion className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Ask the house")}</span></DialogTitle>
        <DialogDescription>{t("Home Assistant Assist answers, and can act on what you have exposed to it.")}</DialogDescription>
      </DialogHeader>
      <div className="assist-scroll">
        {turns.length ? <ol className="assist-transcript" ref={log} role="log" aria-label={t("Conversation")}>
          {turns.map(turn => <li key={turn.id} aria-busy={turn.status === "pending" || undefined}>
            <p className="assist-question">{turn.question}</p>
            {turn.status === "pending" ? <p className="assist-answer" data-kind="pending"><LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" />{t("Waiting for Home Assistant…")}</p>
              : turn.status === "failed" || turn.answer.type === "error" ? <div className="assist-answer" data-kind="error" role="alert">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>{turn.status === "failed" ? message(turn.error) : turn.answer.speech || t("Home Assistant could not answer that.")}</span>
                <Button type="button" variant="outline" className="assist-retry" disabled={pending || !homeOnline} onClick={() => void ask(turn.question, turn.id)}>
                  <RotateCcw aria-hidden="true" />{t("Try again")}</Button>
              </div>
              : <p className="assist-answer" data-kind={turn.answer.type}>
                {turn.answer.type === "action_done" && <><Check size={18} aria-hidden="true" /><span className="sr-only">{t("Done")}: </span></>}
                <span>{turn.answer.speech || t(turn.answer.type === "action_done" ? "Done" : "Home Assistant sent an empty answer.")}</span>
              </p>}
          </li>)}
        </ol> : <p className="assist-empty">{t("Ask a question or give a command, for example “Which lights are on?”")}</p>}
      </div>
      <form className="assist-form" onSubmit={submit}>
        {!homeOnline && <p className="assist-offline" role="status">{t("Home Assistant is offline. You can ask again when it reconnects.")}</p>}
        <div className="assist-compose">
          <input ref={input} className="assist-input" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000}
            aria-label={t("Question for Home Assistant")} placeholder={t("Ask Home Assistant…")} autoComplete="off" enterKeyHint="send" />
          <Button type="submit" className="assist-send" disabled={!draft.trim() || pending || !homeOnline}>
            <SendHorizontal aria-hidden="true" /><span>{t("Send")}</span></Button>
        </div>
        <Button type="button" variant="ghost" className="assist-clear" disabled={!turns.length || pending} onClick={clear}>
          <Trash2 aria-hidden="true" />{t("Clear conversation")}</Button>
      </form>
    </DialogContent>}
  </Dialog>;
}
