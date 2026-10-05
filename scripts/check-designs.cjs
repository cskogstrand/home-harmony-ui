// Run: node scripts/check-designs.cjs (uses the app's existing jsdom dependency).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../public/designs');
const script = fs.readFileSync(path.join(root, 'prototype.js'), 'utf8');

for (const concept of ['hearth', 'weekline', 'together', 'afterglow']) {
  const html = fs.readFileSync(path.join(root, `${concept}.html`), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `http://localhost/designs/${concept}.html` });
  const { window } = dom;
  const document = window.document;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.eval(script);
  const get = selector => { const el = document.querySelector(selector); assert.ok(el, selector); return el; };
  const click = selector => get(selector).click();
  const submit = selector => get(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const change = (selector, value, type = 'change') => {
    const el = get(selector);
    if (el.type === 'checkbox') el.checked = value; else el.value = value;
    el.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  const nav = view => click(`.main-nav [data-go="${view}"]`);

  assert.equal(get('meta[name=color-scheme]').content, 'dark');
  for (const view of ['today', 'week', 'lists', 'school', 'smart']) {
    nav(view);
    assert.equal(get(`[data-view="${view}"]`).hidden, false);
    assert.equal(document.querySelectorAll('[data-view]:not([hidden])').length, 1);
  }
  nav('week');
  click('[data-view=week] [data-person=Emma]');
  assert.equal(document.querySelectorAll('[data-view=week] tbody tr').length, 1);
  assert.match(get('[data-view=week] tbody').textContent, /Piano lesson/);
  click('[data-view=week] [data-person=Everyone]');
  click('[data-view=week] [data-calendar-mode=month]');
  click('[data-view=week] [data-week="1"]');
  assert.equal(get('[data-view=week] [data-date-range]').textContent, 'November 2026');
  click('[data-view=week] [data-week="1"]');
  assert.equal(get('[data-view=week] [data-date-range]').textContent, 'December 2026');
  click('[data-view=week] [data-week="0"]');
  click('[data-view=week] [data-add-event]');
  change('#event-form [name=title]', 'Dentist <check>');
  change('#event-form [name=date]', '2026-10-07');
  change('#event-form [name=person]', 'Leo');
  submit('#event-form');
  assert.match(get('[data-view=week] [data-calendar]').textContent, /Dentist <check>/);
  assert.equal(document.querySelector('check'), null, 'Event text must not become HTML');

  nav('lists');
  change('[data-shopping-form] input', 'Apples <fresh>');
  submit('[data-shopping-form]');
  assert.match(get('[data-view=lists] [data-list=shopping]').textContent, /Apples <fresh>/);
  change('[data-view=lists] [data-check=s1]', true);
  assert.ok([...document.querySelectorAll('[data-check=s1]')].every(el => el.checked), 'Checkbox state is shared across screens');
  click('[data-add-task=tasks]');
  change('#task-form [name=title]', 'Water the plants');
  change('#task-form [name=person]', 'Leo');
  submit('#task-form');
  assert.match(get('[data-view=lists] [data-list=tasks]').textContent, /Water the plants/);

  nav('school');
  click('[data-view=school] [data-timetable=emma]');
  assert.equal(get('#timetable-dialog').open, true);
  assert.match(get('#timetable-image').src, /emma-timetable.svg$/);
  for (const img of document.querySelectorAll('img[src]')) assert.ok(fs.existsSync(path.join(root, img.getAttribute('src'))));
  click('#timetable-dialog [data-close]');

  nav('smart');
  click('[data-room-filter=Kitchen]');
  assert.equal(document.querySelectorAll('[data-room]:not([hidden])').length, 3);
  click('[data-smart-tab=scenes]');
  click('#smart-content [data-scene="Movie night"]');
  click('[data-smart-tab=rooms]');
  assert.equal(get('[data-home=brightness]').value, '15');
  click('[data-temp="0.5"]');
  assert.equal(get('#smart-content [data-value=temperature]').textContent, '22.5°');
  click('[data-secure=lock]');
  change('#security-form [name=pin]', '0000');
  submit('#security-form');
  assert.equal(get('#pin-error').hidden, false);
  assert.equal(get('#smart-content [data-value=locked]').textContent, 'Locked');
  change('#security-form [name=pin]', '1234');
  submit('#security-form');
  assert.equal(get('#smart-content [data-value=locked]').textContent, 'Unlocked');
  click('[data-smart-tab=energy]');
  change('[data-charge-limit]', 90, 'input');
  click('[data-smart-tab=rooms]');
  click('[data-smart-tab=energy]');
  assert.equal(get('[data-charge-limit]').value, '90');
  change('[data-charge-limit]', 70, 'input');
  assert.match(get('[data-car-ready]').textContent, /target already reached/i);
  assert.match(get('#smart-content [data-value=charging]').textContent, /paused/i);
  click('[data-offline-button]');
  assert.equal(get('[data-charge]').disabled, true);
  click('[data-smart-tab=security]');
  assert.equal(get('[data-secure=lock]').disabled, true);
  assert.match(get('.sensor-status').textContent, /unavailable/);
  click('[data-offline-button]');
  assert.equal(get('.sensor-status').textContent, 'Dry');
  click('[data-alarm="Away armed"]');
  change('#security-form [name=pin]', '1234');
  submit('#security-form');
  assert.equal(get('#smart-content [data-value=locked]').textContent, 'Locked', 'Enabled alarm routine locks the door');
  click('[data-smart-tab=system]');
  click('[data-smoke-task]');
  assert.equal(document.querySelectorAll('[data-view=lists] [data-check=t7]').length, 1, 'Existing battery task is reused');
  assert.equal(document.querySelectorAll('[id]').length, new Set([...document.querySelectorAll('[id]')].map(el => el.id)).size, 'No duplicate IDs');
  dom.window.close();
  console.log(`${concept}: routes, calendar, lists, timetables, home controls and offline state passed`);
}
