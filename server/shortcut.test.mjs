import assert from "node:assert/strict";
import test from "node:test";
import { timetableShortcut as shortcut } from "../scripts/build-timetable-shortcut.mjs";

test("shortcut binds setup questions and variables without embedding household credentials", () => {
  const outputs = new Set();
  const checkReferences = value => {
    if (!value || typeof value !== "object") return;
    if (value.Type === "ActionOutput") assert.ok(outputs.has(value.OutputUUID), `Missing earlier output ${value.OutputUUID}`);
    for (const child of Object.values(value)) checkReferences(child);
  };
  for (const { WFWorkflowActionParameters: parameters } of shortcut.WFWorkflowActions) {
    checkReferences(parameters);
    if (parameters.UUID) outputs.add(parameters.UUID);
  }
  assert.equal(shortcut.WFWorkflowImportQuestions.length, 2);
  for (const question of shortcut.WFWorkflowImportQuestions) {
    assert.equal(question.DefaultValue, "");
    assert.equal(shortcut.WFWorkflowActions[question.ActionIndex].WFWorkflowActionParameters[question.ParameterKey], "");
  }
});

test("shortcut requires one shared PDF and confirmation before sending raw bytes with Basic auth", () => {
  assert.deepEqual(shortcut.WFWorkflowTypes, ["ActionExtension"]);
  assert.deepEqual(shortcut.WFWorkflowInputContentItemClasses, ["WFPDFContentItem"]);
  const actions = shortcut.WFWorkflowActions;
  const index = name => actions.findIndex(action => action.WFWorkflowActionIdentifier === `is.workflow.actions.${name}`);
  const parameters = name => actions[index(name)].WFWorkflowActionParameters;
  assert.equal(parameters("count").Input.Value.Type, "ExtensionInput");
  assert.equal(parameters("count").WFCountType, "Items");
  const guard = parameters("conditional");
  assert.equal(guard.WFCondition, 5); // is not
  assert.equal(guard.WFNumberValue, 1);
  assert.equal(guard.WFInput.Variable.Value.OutputUUID, parameters("count").UUID);
  assert.ok(index("conditional") < index("exit"));
  const confirmation = actions.findIndex(action => action.WFWorkflowActionParameters.WFAlertActionCancelButtonShown === true);
  assert.ok(index("exit") < confirmation && confirmation < index("downloadurl"));
  const upload = parameters("downloadurl");
  assert.equal(upload.WFHTTPMethod, "POST");
  assert.equal(upload.WFHTTPBodyType, "File");
  assert.equal(upload.WFRequestVariable.Value.Type, "ExtensionInput");
  const headers = Object.fromEntries(upload.WFHTTPHeaders.Value.WFDictionaryFieldValueItems.map(item => [item.WFKey.Value.string, item.WFValue.Value]));
  assert.equal(headers["Content-Type"].string, "application/pdf");
  assert.equal(headers.Authorization.string, "Basic \uFFFC");
  assert.equal(headers.Authorization.attachmentsByRange["{6, 1}"].OutputUUID, parameters("base64encode").UUID);
  assert.equal(parameters("base64encode").WFBase64LineBreakMode, "None");
  assert.ok(index("showresult") > index("downloadurl"));
});
