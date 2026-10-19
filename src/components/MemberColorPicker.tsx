import { useId, useState } from "react";
import { Check } from "lucide-react";
import { useFamily, type FamilyMember } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { memberPalette, memberColorForeground } from "@/lib/member-colors";
import { memberColorSchema } from "../../shared/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MemberColorPicker({ person }: { person: FamilyMember }) {
  const { t } = useI18n();
  const { setMemberColor } = useFamily();
  const shared = useSharedConfiguration();
  const id = useId();
  const isPreset = memberPalette.some(preset => preset.color === person.color.toLowerCase());
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(person.color);
  const [invalid, setInvalid] = useState(false);
  const disabled = !shared?.state.loaded || !!shared.state.error;
  return <Popover onOpenChange={open => {
    if (open) { setDraft(person.color); setCustom(!isPreset); setInvalid(false); }
  }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-label={t("Color for {name}", { name: person.name })}>
      <span className="size-5 shrink-0 rounded-full border border-current/20" style={{ background: person.color }} aria-hidden="true" />{t("Color")}
    </Button></PopoverTrigger>
    <PopoverContent className="max-w-[calc(100vw-2rem)] space-y-3" align="start" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="break-words font-medium">{t("Color for {name}", { name: person.name })}</h3>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={t("Preset colors")}>
        {memberPalette.map(preset => <Button key={preset.color} type="button" variant="outline" className="h-12 px-0" disabled={disabled}
          aria-label={t(preset.name)} title={t(preset.name)} aria-pressed={person.color.toLowerCase() === preset.color}
          onClick={() => { if (setMemberColor(person.id, preset.color)) { setCustom(false); setDraft(preset.color); setInvalid(false); } }}>
          <span className="flex size-8 items-center justify-center rounded-full" style={{ background: preset.color, color: memberColorForeground(preset.color) }}>
            {person.color.toLowerCase() === preset.color && <Check size={18} aria-hidden="true" />}
          </span>
        </Button>)}
      </div>
      <Button type="button" variant="outline" className="w-full" disabled={disabled} aria-expanded={custom} aria-controls={`${id}-custom`} onClick={() => setCustom(!custom)}>{t("Custom color")}</Button>
      {custom && <form id={`${id}-custom`} className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const result = memberColorSchema.safeParse(draft.trim());
        setInvalid(!result.success);
        if (result.success) setMemberColor(person.id, result.data.toLowerCase());
      }}>
        <div className="flex items-end gap-2">
          <label className="shrink-0"><span className="sr-only">{t("Choose custom color")}</span><input type="color" className="h-12 w-12 cursor-pointer rounded-lg border bg-background p-1" disabled={disabled} value={memberColorSchema.safeParse(draft).success ? draft : person.color} onChange={event => { setDraft(event.target.value); setInvalid(false); }} /></label>
          <label className="min-w-0 flex-1 space-y-1 text-sm"><span>{t("Hex color")}</span><Input className="h-12" value={draft} disabled={disabled} spellCheck={false} autoComplete="off" maxLength={7} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => { setDraft(event.target.value); setInvalid(false); }} /></label>
        </div>
        {invalid && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{t("Use a six-digit hex color, like #a5c9bd.")}</p>}
        <Button type="submit" className="w-full" disabled={disabled}>{t("Apply color")}</Button>
      </form>}
    </PopoverContent>
  </Popover>;
}
