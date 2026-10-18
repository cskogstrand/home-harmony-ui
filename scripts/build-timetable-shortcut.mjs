import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const id = number => `A17E0000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const output = (number, name) => ({ Type: "ActionOutput", OutputUUID: id(number), OutputName: name });
const input = { Type: "ExtensionInput" };
const attachment = value => ({ Value: value, WFSerializationType: "WFTextTokenAttachment" });
const text = (string, variable) => ({ WFSerializationType: "WFTextTokenString", Value: {
  string, ...(variable ? { attachmentsByRange: { [`{${string.indexOf("\uFFFC")}, 1}`]: variable } } : {}),
} });
const action = (name, parameters) => ({ WFWorkflowActionIdentifier: `is.workflow.actions.${name}`, WFWorkflowActionParameters: parameters });

export const timetableShortcut = {
  WFWorkflowName: "Upload timetable",
  WFWorkflowClientVersion: "2605",
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowIcon: { WFWorkflowIconStartColor: 2071128575, WFWorkflowIconGlyphNumber: 59726 },
  WFWorkflowTypes: ["ActionExtension"],
  WFWorkflowInputContentItemClasses: ["WFPDFContentItem"],
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowHasOutputFallback: false,
  WFWorkflowOutputContentItemClasses: [],
  WFQuickActionSurfaces: [],
  WFWorkflowImportQuestions: [
    { ActionIndex: 0, Category: "Parameter", ParameterKey: "WFTextActionText", DefaultValue: "", Text: "Paste this person's Upload URL from Afterglow → School → Share from iPhone. Use your trusted dashboard address, reachable from this iPhone." },
    { ActionIndex: 1, Category: "Parameter", ParameterKey: "WFTextActionText", DefaultValue: "", Text: "Enter your dashboard password (not your Home Assistant token). It is saved in this shortcut. Keep your configured copy private." },
  ],
  WFWorkflowActions: [
    action("gettext", { UUID: id(1), WFTextActionText: "" }),
    action("gettext", { UUID: id(2), WFTextActionText: "" }),
    action("count", { UUID: id(3), WFCountType: "Items", Input: attachment(input) }),
    action("conditional", { GroupingIdentifier: id(4), WFControlFlowMode: 0, WFCondition: 5, WFNumberValue: 1, WFConditionalActionString: "1", WFInput: { Type: "Variable", Variable: attachment(output(3, "Count")) } }),
    action("alert", { WFAlertActionTitle: "Share one PDF", WFAlertActionMessage: "Open a PDF, tap Share, then Upload timetable. Select exactly one PDF (up to 10 MB and 20 pages).", WFAlertActionCancelButtonShown: false }),
    action("exit", {}),
    action("conditional", { GroupingIdentifier: id(4), WFControlFlowMode: 2 }),
    action("alert", {
      WFAlertActionTitle: "Replace timetable?", WFAlertActionCancelButtonShown: true,
      WFAlertActionMessage: text("This PDF will replace the selected person's timetable on every screen. Check the destination before continuing:\n\n\uFFFC", output(1, "Upload URL")),
    }),
    action("gettext", { UUID: id(5), WFTextActionText: text("dashboard:\uFFFC", output(2, "Dashboard password")) }),
    action("base64encode", { UUID: id(6), WFEncodeMode: "Encode", WFBase64LineBreakMode: "None", WFInput: attachment(output(5, "Text")) }),
    action("downloadurl", {
      UUID: id(7), WFURL: text("\uFFFC", output(1, "Upload URL")), Advanced: true, ShowHeaders: true,
      WFHTTPMethod: "POST", WFHTTPBodyType: "File", WFRequestVariable: attachment(input),
      WFFormValues: { Value: { WFDictionaryFieldValueItems: [] }, WFSerializationType: "WFDictionaryFieldValue" },
      WFHTTPHeaders: { WFSerializationType: "WFDictionaryFieldValue", Value: { WFDictionaryFieldValueItems: [
        { WFItemType: 0, WFKey: text("Content-Type"), WFValue: text("application/pdf") },
        { WFItemType: 0, WFKey: text("Authorization"), WFValue: text("Basic \uFFFC", output(6, "Base64 Encoded")) },
      ] } },
    }),
    action("getvalueforkey", { UUID: id(8), WFDictionaryKey: "error", WFInput: attachment(output(7, "Contents of URL")) }),
    action("conditional", { GroupingIdentifier: id(9), WFControlFlowMode: 0, WFCondition: 100, WFInput: { Type: "Variable", Variable: attachment(output(8, "Dictionary Value")) } }),
    action("showresult", { Text: text("\uFFFC", output(8, "Dictionary Value")) }),
    action("conditional", { GroupingIdentifier: id(9), WFControlFlowMode: 2 }),
    action("exit", {}),
  ],
};

// shortcut: ship one signed template; personalize on import because edits invalidate Apple's signature.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const temporary = await mkdtemp(join(tmpdir(), "afterglow-shortcut-"));
  try {
    const source = join(temporary, "Upload timetable.shortcut");
    const signed = join(temporary, "signed.shortcut");
    await writeFile(source, JSON.stringify(timetableShortcut));
    execFileSync("plutil", ["-convert", "xml1", source]);
    // Apple receives only this blank template for validation, never household credentials.
    execFileSync("shortcuts", ["sign", "--mode", "anyone", "--input", source, "--output", signed], { stdio: "inherit", timeout: 60000 });
    const destination = new URL("../public/shortcuts/Upload%20timetable.shortcut", import.meta.url);
    await mkdir(new URL(".", destination), { recursive: true });
    await rename(signed, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
