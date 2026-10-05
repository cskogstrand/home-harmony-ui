// Prototype data stays in this page and resets on reload. No home or calendar APIs.
const people = ['Anna', 'Erik', 'Emma', 'Leo'];
const baseDate = '2026-10-05';
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  list: '<path d="m3 6 1 1 2-2m3 1h12M3 12h3m3 0h12M3 18h3m3 0h12"/>',
  school: '<path d="m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7m4-2v9"/>',
  controls: '<path d="M5 3v5m0 6v7M12 3v10m0 6v2M19 3v2m0 6v10"/><circle cx="5" cy="11" r="3"/><circle cx="12" cy="16" r="3"/><circle cx="19" cy="8" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  cloud: '<path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13 3 4 4 0 0 1-1 8H6"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>',
  light: '<path d="M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0l-1 2H9Z"/>',
  temp: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  car: '<path d="m5 7 2-4h10l2 4 3 4v8H2v-8Zm-3 5h20M5 19v2m14-2v2M5 15h2m10 0h2"/>',
  bolt: '<path d="m14 2-10 12h7l-1 8L21 9h-8Z"/>',
  bag: '<path d="M4 7h16l-1 14H5Zm4 0V5a4 4 0 0 1 8 0v2"/>',
  leaf: '<path d="M20 3C5 1 1 10 6 16s16 3 14-13ZM4 21 16 9"/>',
  cup: '<path d="M4 8h12v7a6 6 0 0 1-12 0Zm12 1h3a3 3 0 0 1 0 6h-3M6 3v2m4-2v2M2 22h17"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14m10-14v14M3 10h4m10 0h4M3 14h4m10 0h4"/>',
  water: '<path d="M12 2c0 0-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
  plug: '<path d="M8 2v6m8-6v6M5 8h14v4a7 7 0 0 1-14 0Zm7 11v3"/>',
  blind: '<path d="M3 3h18v13H3Zm0 4h18M3 11h18M3 15h18m-3 1v5"/>',
  wifi: '<path d="M2 7a16 16 0 0 1 20 0M5 11a11 11 0 0 1 14 0M8 15a6 6 0 0 1 8 0"/><circle cx="12" cy="19" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  heart: '<path d="M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6Z"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.home}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const avatar = name => `<span class="avatar ${name.toLowerCase()}">${name === 'Erik' ? 'Er' : name === 'Emma' ? 'Em' : name[0]}</span>`;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const events = [
  ['2026-10-05','08:30','Anna','At the office','Home by 17:15'],
  ['2026-10-05','16:30','Erik','Football pickup','Pick up Leo · Sports hall'],
  ['2026-10-05','17:00','Emma','Piano lesson','Music school · Bring sheet music'],
  ['2026-10-05','16:30','Leo','Football practice','Sports hall · Erik drives'],
  ['2026-10-06','17:00','Anna','Parents’ meeting','School · Room 4'],
  ['2026-10-06','08:00','Erik','Office day','Home by 16:30'],
  ['2026-10-06','15:30','Emma','Art club','School art room'],
  ['2026-10-06','14:15','Leo','Library visit','With after-school club'],
  ['2026-10-07','09:00','Anna','Work from home','Study'],
  ['2026-10-07','18:00','Erik','Evening run','Riverside'],
  ['2026-10-07','17:00','Emma','Swimming','Pool · Bring swim bag'],
  ['2026-10-07','16:30','Leo','Football practice','Sports hall · Anna drives'],
  ['2026-10-08','08:30','Anna','At the office','Home by 17:15'],
  ['2026-10-08','15:00','Erik','School pickup','Emma & Leo'],
  ['2026-10-08','08:30','Emma','School trip','Forest day · Pack lunch'],
  ['2026-10-08','17:00','Leo','Playdate','At Oliver’s house'],
  ['2026-10-09','16:30','Anna','Groceries','Use family shopping list'],
  ['2026-10-09','09:00','Erik','Work from home','Study'],
  ['2026-10-09','18:30','Emma','Movie night','Family room'],
  ['2026-10-09','18:30','Leo','Movie night','Family room'],
  ['2026-10-10','10:00','Leo','Football match','Sports hall · Family welcome'],
  ['2026-10-11','13:00','Anna','Lunch with grandparents','At home'],
].map(([date,time,person,title,detail], id) => ({id,date,time,person,title,detail}));
const tasks = [
  {id:'t1', title:'Empty the dishwasher', person:'Emma', done:false, kind:'daily', detail:'Before dinner'},
  {id:'t2', title:'Feed Milo', person:'Leo', done:false, kind:'daily', detail:'Food + fresh water'},
  {id:'t3', title:'Pack tomorrow’s bags', person:'Emma', done:false, kind:'daily', detail:'After dinner'},
  {id:'t4', title:'Take out recycling', person:'Erik', done:true, kind:'daily', detail:'Before 08:00'},
  {id:'t5', title:'Book the tyre change', person:'Anna', done:false, kind:'tasks', detail:'This week'},
  {id:'t6', title:'Fix the hallway shelf', person:'Erik', done:false, kind:'tasks', detail:'This weekend'},
  {id:'t7', title:'Replace smoke detector battery', person:'Erik', done:false, kind:'tasks', detail:'Needs attention · Offline'},
];
const shopping = [
  {id:'s1', title:'Oat milk', detail:'2 cartons', done:false},
  {id:'s2', title:'Sourdough bread', detail:'1 loaf', done:false},
  {id:'s3', title:'Cherry tomatoes', detail:'500 g', done:false},
  {id:'s4', title:'Bananas', detail:'6', done:false},
  {id:'s5', title:'Pasta', detail:'1 pack', done:true},
];
const home = {light:true, kitchen:true, plug:false, brightness:65, kitchenBrightness:80, blinds:75, temperature:21, locked:true, water:true, charging:true, chargeLimit:80, alarm:'Disarmed', scene:'', routine1:true, routine2:true, routine3:false, away:false};
let activePerson = 'Everyone', weekOffset = 0, monthDate = '2026-10-01', calendarMode = 'week', room = 'All rooms', smartTab = 'rooms', offline = false, pendingSecurity = null, toastTimer;
const initialView = document.body.dataset.start || 'today';
let currentView = initialView;
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };
const dateLabel = (date, options) => new Intl.DateTimeFormat('en-GB', {...options,timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const range = (key, label, max = 100) => `<label class="range-line">${label}<input type="range" min="0" max="${max}" value="${home[key]}" data-home="${key}" aria-label="${label}"><output data-value="${key}">${home[key]}%</output></label>`;
const toggle = (key, label) => `<label class="switch"><input type="checkbox" data-home="${key}" aria-label="${label}" ${home[key] ? 'checked' : ''}><span></span></label>`;
const thermometer = () => `<div class="temp"><button class="icon-button" data-temp="-0.5" aria-label="Lower target temperature">${icon('minus')}</button><output data-value="temperature">21°</output><button class="icon-button" data-temp="0.5" aria-label="Raise target temperature">${icon('plus')}</button></div>`;

function notify(message) {
  const toast = $('.toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
}
function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.setAttribute('aria-hidden','true'); });
}
function checkRow(item, shoppingItem = false, compact = false) {
  return `<label class="check-row"><input type="checkbox" data-check="${item.id}" ${item.done ? 'checked' : ''}><span class="task-label">${esc(item.title)}${compact ? '' : `<small>${esc(item.detail)}</small>`}</span>${shoppingItem ? `<span class="quantity">${esc(item.detail)}</span>` : avatar(item.person)}</label>`;
}
function renderLists() {
  $$('[data-list]').forEach(el => {
    const kind = el.dataset.list, limit = Number(el.dataset.limit || 100);
    const items = kind === 'shopping' ? shopping : tasks.filter(item => item.kind === kind);
    el.innerHTML = items.slice(0,limit).map(item => checkRow(item, kind === 'shopping', el.hasAttribute('data-compact'))).join('');
  });
  $$('[data-task]').forEach(el => { el.innerHTML = checkRow(tasks.find(item => item.id === el.dataset.task), false, true); });
  $$('[data-count]').forEach(el => {
    const kind = el.dataset.count;
    const items = kind === 'shopping' ? shopping : tasks.filter(item => item.kind === kind);
    const done = items.filter(item => item.done).length;
    el.textContent = kind === 'shopping' ? `${items.length - done} to pick up` : `${done} of ${items.length} done`;
  });
}
function renderCalendar() {
  const start = addDays(baseDate, weekOffset * 7);
  const shown = events.filter(event => activePerson === 'Everyone' || event.person === activePerson);
  const dayEvents = (date, person) => shown.filter(event => event.date === date && (!person || event.person === person)).sort((a,b) => a.time.localeCompare(b.time));
  const eventButton = event => `<button class="event ${event.person.toLowerCase()}" data-event="${event.id}"><time>${event.time}${calendarMode === 'month' ? ' · ' + event.person : ''}</time>${esc(event.title)}</button>`;
  let content;
  if (calendarMode === 'week') {
    const dates = Array.from({length:7}, (_, i) => addDays(start, i));
    content = `<div class="calendar-scroll" tabindex="0" role="region" aria-label="Family week, scroll horizontally on smaller screens"><table class="week-table"><caption hidden>Weekly schedule by family member</caption><thead><tr><th scope="col">Our family</th>${dates.map(date => `<th scope="col" class="${date === baseDate ? 'today-col' : ''}">${dateLabel(date, {weekday:'short'})}<strong>${Number(date.slice(-2))}</strong></th>`).join('')}</tr></thead><tbody>${people.filter(person => activePerson === 'Everyone' || person === activePerson).map(person => `<tr><th scope="row">${avatar(person)}<span>${person}</span></th>${dates.map(date => `<td class="${date === baseDate ? 'today-col' : ''}">${dayEvents(date,person).map(eventButton).join('') || '<span class="empty-cell">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else {
    const first = monthDate;
    const startDay = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
    content = `<div class="month-wrapper"><div class="month-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<div class="month-day">${day}</div>`).join('')}${Array.from({length:42}, (_,i) => {
      const date = addDays(first, i - startDay);
      return `<div class="month-cell ${date === baseDate ? 'today' : ''} ${date.slice(0,7) !== first.slice(0,7) ? 'outside' : ''}"><span class="day-number">${Number(date.slice(-2))}</span>${dayEvents(date).map(eventButton).join('')}</div>`;
    }).join('')}</div></div>`;
  }
  $$('[data-calendar]').forEach(el => { el.innerHTML = content; });
  $$('[data-date-range]').forEach(el => { el.textContent = calendarMode === 'month' ? dateLabel(monthDate,{month:'long',year:'numeric'}) : `${dateLabel(start,{day:'numeric',month:'short'})} – ${dateLabel(addDays(start,6),{day:'numeric',month:'short',year:'numeric'})}`; });
  $$('[data-person]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.person === activePerson)));
  $$('[data-calendar-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.calendarMode === calendarMode)));
}
function calendarControls() {
  return `<div class="calendar-toolbar"><div class="heading-actions"><button class="icon-button" data-week="-1" aria-label="Previous period">${icon('back')}</button><h2 data-date-range>5–11 October 2026</h2><button class="icon-button" data-week="1" aria-label="Next period">${icon('arrow')}</button><button class="ghost" data-week="0">This week</button></div><div class="segment" aria-label="Calendar view"><button data-calendar-mode="week" aria-pressed="true">Week</button><button data-calendar-mode="month" aria-pressed="false">Month</button></div></div><div class="member-filters" aria-label="Filter by family member"><button data-person="Everyone" aria-pressed="true">Everyone</button>${people.map(name => `<button data-person="${name}" aria-pressed="false">${avatar(name)}${name}</button>`).join('')}</div><div data-calendar></div>`;
}
function createViews() {
  $('#shared-views').innerHTML = `
  <section data-view="week" hidden aria-labelledby="week-title"><div class="page-heading"><div><div class="eyebrow">A little less juggling</div><h1 id="week-title">The family week.</h1><p>One shared plan. A little space for everyone.</p></div><button class="primary" data-add-event>${icon('plus')} Add event</button></div>${calendarControls()}<div class="note room-note">${icon('info')}School hours live in School. This calendar keeps the pickups, activities and exceptions easy to spot.</div></section>
  <section data-view="lists" hidden aria-labelledby="lists-title"><div class="page-heading"><div><div class="eyebrow">Many hands, lighter days</div><h1 id="lists-title">A little help at home.</h1><p>Everyday rhythms, the shopping run, and the things for later.</p></div></div><div class="list-columns">
    <article class="panel"><div class="panel-heading"><h2>Daily rhythm</h2>${icon('sun')}</div><p class="list-count" data-count="daily"></p><div data-list="daily"></div><button class="ghost" data-add-task="daily">${icon('plus')} Add daily task</button></article>
    <article class="panel"><div class="panel-heading"><h2>Shopping list</h2>${icon('bag')}</div><p class="list-count" data-count="shopping"></p><div data-list="shopping" data-compact></div><form class="add-form" data-shopping-form><input type="text" name="item" maxlength="80" placeholder="What do we need?" aria-label="New shopping item" required><button type="submit" aria-label="Add shopping item">${icon('plus')}</button></form></article>
    <article class="panel"><div class="panel-heading"><h2>On our radar</h2>${icon('list')}</div><p class="list-count" data-count="tasks"></p><div data-list="tasks"></div><button class="ghost" data-add-task="tasks">${icon('plus')} Add a task</button></article>
  </div></section>
  <section data-view="school" hidden aria-labelledby="school-title"><div class="page-heading"><div><div class="eyebrow">Ready for the school day</div><h1 id="school-title">School, at a glance.</h1><p>The timetables from school, just as they were shared. Tap an image to enlarge.</p></div></div><div class="split-grid">${['Emma','Leo'].map((name,i) => `<article class="panel school-card"><div class="panel-heading"><div class="person-label">${avatar(name)}<div><h2>${name}’s week</h2><small class="muted">Year ${i ? '3' : '6'} · Autumn term</small></div><span class="badge">Sample image</span></div></div><button data-timetable="${name.toLowerCase()}" aria-label="Enlarge ${name}’s timetable"><img src="./assets/${name.toLowerCase()}-timetable.svg" alt="Dummy ${name} school timetable: Monday to Friday, 08:30 to ${i ? '13:30' : '14:15'}. Tap to read all lessons." width="960" height="620"></button><div class="note">${icon('bag')}<span>${i ? 'Tomorrow: library day. Remember your library book.' : 'Tomorrow: PE. Pack trainers and a water bottle.'}</span></div><p class="school-note" style="margin-top:16px">${i ? 'School finishes at 13:30 · After-school club until 15:00.' : 'School finishes at 14:15 · Piano today at 17:00.'}</p><details><summary>Timetable source</summary><p>Dummy timetable served from a static image URL. In the app, a parent can replace this with the school’s image link.</p><a class="button" href="./assets/${name.toLowerCase()}-timetable.svg" target="_blank" rel="noopener">Open source image ${icon('expand')}</a></details></article>`).join('')}</div></section>
  <section data-view="smart" hidden aria-labelledby="smart-title"><div class="page-heading"><div><div class="eyebrow">A home that takes care of you</div><h1 id="smart-title">Make yourself at home.</h1><p>Rooms, comfort, security and energy. Everything in its place.</p></div><span class="badge" data-hub-state>${icon('wifi')} Hub connected</span></div><div class="smart-tabs" aria-label="Smart home sections">${[['rooms','home','Rooms & devices'],['scenes','sun','Scenes'],['climate','temp','Climate'],['security','shield','Security'],['energy','bolt','Energy & car'],['routines','clock','Routines'],['system','controls','System']].map(([id,ic,label])=>`<button data-smart-tab="${id}" aria-pressed="${id === 'rooms'}">${icon(ic)}${label}</button>`).join('')}</div><div id="smart-content"></div></section>`;
  $$('[data-calendar-home]').forEach(el => { el.innerHTML = calendarControls(); });
}
function device(title, subtitle, ic, control, roomName, extra = '') {
  return `<article class="panel device ${extra}" data-room="${roomName}"><div class="device-top">${icon(ic)}${extra === 'offline' ? '<span class="badge warning">Offline</span>' : '<span class="badge device-online">Connected</span>'}</div><h3>${title}</h3><p>${subtitle}</p>${control}</article>`;
}
function renderSmart() {
  const cards = [
    device('Living room lights','Living room · Ceiling + floor lamp','light',`<div class="control-line"><span data-status="light"></span>${toggle('light','Living room lights')}</div>${range('brightness','Brightness')}`, 'Living room'),
    device('Kitchen lights','Kitchen · Ceiling lights','light',`<div class="control-line"><span data-status="kitchen"></span>${toggle('kitchen','Kitchen lights')}</div>${range('kitchenBrightness','Kitchen brightness')}`, 'Kitchen'),
    device('Bedroom heating','Bedrooms · Measured 20.5°C','temp',thermometer(),'Bedrooms'),
    device('Window blinds','Living room · South windows','blind',range('blinds','Open position'),'Living room'),
    device('Coffee machine','Kitchen · Smart plug','plug',`<div class="control-line"><span data-status="plug"></span>${toggle('plug','Coffee machine power')}</div>`,'Kitchen'),
    device('Front door','Entrance · PIN to change','lock','<div class="control-line"><span data-value="locked"></span><button data-secure="lock">Manage lock</button></div>','Entrance'),
    device('Water supply','Kitchen · Leak protection','water','<div class="control-line"><span data-value="water"></span><button data-secure="water">Manage valve</button></div>','Kitchen'),
    device('Family car','Garage · 72% · 284 km range','car','<div class="control-line"><span data-value="charging"></span><button data-charge>Pause charging</button></div>','Garage'),
    device('Smoke detector','Entrance · Last seen 2 hours ago','shield','<div class="control-line"><small>Battery 12% · Check device</small><button data-smoke-help>View issue</button></div>','Entrance','offline'),
  ];
  const views = {
    rooms: `<div class="chips" aria-label="Filter devices by room">${['All rooms','Living room','Kitchen','Bedrooms','Entrance','Garage'].map(name=>`<button data-room-filter="${name}" aria-pressed="${room === name}">${name}</button>`).join('')}</div><div class="device-grid">${cards.join('')}</div>`,
    scenes: `<p class="muted" style="margin-bottom:20px">One tap sets the mood. Lights and comfort change together.</p><div class="device-grid">${[['Morning','sun','Lights 80% · Heating 21°C · Blinds open'],['Dinner','cup','Lights 60% · Kitchen on · Heating 21°C'],['Movie night','film','Lights 15% · Blinds closed · Heating 22°C'],['Good night','moon','Lights off · Heating 18°C · Blinds closed']].map(([name,ic,desc])=>`<button class="panel scene-card" data-scene="${name}" aria-pressed="${home.scene === name}">${icon(ic)}<h3>${name}</h3><small>${desc}</small></button>`).join('')}</div><div class="note room-note">${icon('lock')}Scenes leave the alarm and locks as they are. Manage them in Security.</div>`,
    climate: `<div class="device-grid">${device('Bedroom temperature','Measured 20.5°C · Comfort target','temp',thermometer(),'Bedrooms')}${device('Living room air','Temperature sensor · Updated 15:41','leaf','<div class="control-line"><strong>21.2°C</strong><span class="badge">42% humidity</span></div>','Living room')}${device('South-facing blinds','Reduce glare in the family room','blind',range('blinds','Open position'),'Living room')}</div><div class="panel room-note"><div class="panel-heading"><div><h2>Save energy while we’re away</h2><p class="muted small" style="margin-top:6px">Lower the target to 17°C. Turning this off restores 21°C.</p></div>${toggle('away','Away energy saving')}</div></div>`,
    security: `<div class="split-grid"><article class="panel"><div class="security-status">${icon('shield')}<div><h2 data-value="alarm">Disarmed</h2><p class="muted small">Family at home · Door status shown below</p></div></div><div class="scene-row">${['Disarmed','Day armed','Night armed','Away armed'].map(mode=>`<button data-alarm="${mode}" data-secure="alarm">${mode}</button>`).join('')}</div><div class="sensor-row">${icon('lock')}<div><strong>Front door</strong><small class="muted" style="display:block" data-value="locked">Locked</small></div><button data-secure="lock">Manage</button></div><p class="small muted" style="margin-top:20px">Changes ask for a parent PIN. Demo PIN: 1234.</p></article><article class="panel"><h2>Safety around the house</h2><div class="sensor-row">${icon('shield')}<span>Smoke detector</span><button data-smoke-help class="badge warning">Offline · Check</button></div><div class="sensor-row">${icon('water')}<span>Kitchen leak sensor</span><span class="badge sensor-status">Dry</span></div><div class="sensor-row">${icon('home')}<span>Kitchen motion</span><span class="badge sensor-status">No motion</span></div><div class="sensor-row">${icon('lock')}<span>Doors & windows</span><span class="badge sensor-status">All closed</span></div><div class="sensor-row">${icon('water')}<span>Water valve</span><button data-secure="water" data-value="water">Open</button></div></article></div>`,
    energy: `<div class="stat-grid"><article class="panel stat"><small>Home use now</small><strong>2.1 <small>kW</small></strong><small>Excludes EV charging</small></article><article class="panel stat"><small>Electricity price · sample</small><strong>0.85 <small>NOK/kWh</small></strong><small>Lower after 22:00</small></article><article class="panel stat"><small>Used today</small><strong>18.4 <small>kWh</small></strong><small>3.2 kWh below yesterday</small></article></div><div class="split-grid"><article class="panel"><div class="panel-heading"><h2>Family car</h2>${icon('car')}</div><div class="car-charge"><strong>72%</strong><span class="muted">284 km range</span></div><div class="battery">${'<i></i>'.repeat(10)}</div><div class="sensor-row"><span data-value="charging">Charging · 7.4 kW</span><button data-charge>Pause charging</button></div><label class="range-line">Charge limit<input type="range" min="50" max="100" step="5" value="80" data-charge-limit aria-label="Car charge limit"><output data-charge-limit-value>80%</output></label><div class="note" style="margin-top:15px">${icon('clock')}<span data-car-ready>Ready at 17:10 · Target 80%</span></div></article><article class="panel"><div class="panel-heading"><h2>Today’s energy</h2><span class="badge">Sample readings</span></div><div class="energy-chart" role="img" aria-label="Sample energy usage: peak in the morning, lower at midday, rising this afternoon">${[23,18,15,15,20,37,70,95,66,40,31,29,35,40,52,61].map((height,i)=>`<i class="${i === 7 || i === 15 ? 'peak' : ''}" style="height:${height}%"></i>`).join('')}</div><div class="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>16:00</span></div><p class="muted small">Next school run tomorrow at 08:00. There’s enough range for the morning.</p></article></div>`,
    routines: `<article class="panel"><h2>The home’s little routines</h2>${[['routine1','Lights out at midnight','Every day at 00:00 → switch off living room and kitchen lights'],['routine2','Lock when the alarm is armed','When Away armed is activated → lock the front door'],['routine3','A warm welcome','When motion is detected after sunset → turn on kitchen lights']].map(([key,title,desc])=>`<div class="routine-row">${icon('clock')}<div><h3>${title}</h3><small>${desc}</small></div>${toggle(key,title)}</div>`).join('')}<p class="muted small" style="margin-top:20px">Demo routines can be enabled or paused here. Scheduled triggers are illustrative; no background routines run.</p></article>`,
    system: `<div class="system-list"><article class="panel"><h2>Home health</h2><div class="sensor-row">${icon('wifi')}<span>Home hub</span><span class="badge" data-hub-state>Connected</span></div><div class="sensor-row">${icon('light')}<span>9 devices</span><span class="badge warning">1 needs attention</span></div><details open><summary>Smoke detector is offline</summary><p>Last seen 2 hours ago. Battery reported 12%. Replace the battery and check the detector itself; this screen cannot confirm smoke safety while it is offline.</p><button data-smoke-task>Add battery task</button></details><details><summary>Activity</summary><p data-activity>15:40 · Living room lights set to 65%<br>15:25 · Family car connected<br>15:10 · Front door locked</p></details></article><article class="panel"><h2>Family & access</h2><div class="sensor-row">${avatar('Anna')}<span>Anna</span><span class="badge">Parent</span></div><div class="sensor-row">${avatar('Erik')}<span>Erik</span><span class="badge">Parent</span></div><div class="sensor-row">${avatar('Emma')}<span>Emma & Leo</span><span class="badge">Family tablet</span></div><details><summary>Shared tablet controls</summary><p>Everyone can use lists, school and everyday home controls. Locks, alarm modes and the water valve ask for a parent PIN. Demo PIN 1234 is only an interaction example, not real authentication.</p></details><details><summary>Connections in this concept</summary><p>Calendar, vehicle, school images and home readings are example data. The production app will use the existing home integration plus family data sources.</p></details></article></div>`,
  };
  $('#smart-content').innerHTML = views[smartTab];
  $$('[data-smart-tab]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.smartTab === smartTab)));
  filterRooms();
  syncHome();
}
function filterRooms() {
  $$('[data-room]').forEach(el => { el.hidden = room !== 'All rooms' && el.dataset.room !== room; });
  $$('[data-room-filter]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.roomFilter === room)));
}
function syncHome() {
  $$('[data-home]').forEach(el => { const key = el.dataset.home; if (el.type === 'checkbox') el.checked = Boolean(home[key]); else el.value = home[key]; });
  const values = {brightness:`${home.brightness}%`, kitchenBrightness:`${home.kitchenBrightness}%`, blinds:`${home.blinds}%`, temperature:`${home.temperature}°`, locked:home.locked ? 'Locked' : 'Unlocked', water:home.water ? 'Valve open' : 'Valve closed', charging:home.charging ? 'Charging · 7.4 kW' : 'Charging paused', alarm:home.alarm, light:home.light ? `On · ${home.brightness}%` : 'Off'};
  $$('[data-value]').forEach(el => { el.textContent = values[el.dataset.value]; });
  $$('[data-status]').forEach(el => { el.textContent = home[el.dataset.status] ? 'On' : 'Off'; });
  $$('[data-charge]').forEach(el => { el.textContent = home.charging ? 'Pause charging' : 'Resume charging'; });
  $$('[data-scene]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.scene === home.scene)));
  $$('[data-alarm]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.alarm === home.alarm)));
  $$('[data-home], [data-temp], [data-charge], [data-charge-limit], [data-scene], [data-secure]').forEach(el => { el.disabled = offline; });
  $$('[data-hub-state]').forEach(el => { el.textContent = offline ? 'Hub offline · Last known states' : 'Hub connected'; });
  $$('[data-charge-limit]').forEach(el => { el.value = home.chargeLimit; });
  $$('[data-charge-limit-value]').forEach(el => { el.textContent = `${home.chargeLimit}%`; });
  $$('[data-car-ready]').forEach(el => { el.textContent = home.chargeLimit <= 72 ? 'Charge target already reached · 72%' : home.charging ? `Target ${home.chargeLimit}% · Ready time is illustrative` : 'Paused · Resume to calculate ready time'; });
  $$('[data-offline-button]').forEach(el => { el.textContent = offline ? 'Reconnect demo hub' : 'Try hub offline'; });
  $('#offline-banner').hidden = !offline;
  $$('.device-online').forEach(el => { el.textContent = offline ? 'Last known' : 'Connected'; });
  $$('.sensor-status').forEach(el => { if (!el.dataset.original) el.dataset.original = el.textContent; el.textContent = offline ? 'State unavailable' : el.dataset.original; });
}
function navigate(view, changeHash = true) {
  if (!['today','week','lists','school','smart'].includes(view)) view = initialView;
  currentView = view;
  $$('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
  $$('[data-go]').forEach(el => { if (el.closest('.main-nav')) { if (el.dataset.go === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); } });
  if (view === 'smart') renderSmart();
  if (changeHash && location.hash !== `#${view}`) history.pushState(null,'',`#${view}`);
  window.scrollTo(0,0);
  if (changeHash) { const heading = $(`[data-view="${view}"] h1`); heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}
function openSecurity(key, alarm) {
  if (offline) return;
  pendingSecurity = {key, alarm};
  const action = key === 'lock' ? (home.locked ? 'Unlock the front door?' : 'Lock the front door?') : key === 'water' ? (home.water ? 'Close the water valve?' : 'Open the water valve?') : `Set alarm to ${alarm.toLowerCase()}?`;
  $('#security-title').textContent = action;
  $('#security-description').textContent = 'Enter the demo parent PIN (1234) to confirm. This changes the prototype only.';
  $('#security-form').reset(); $('#pin-error').hidden = true;
  $('#security-dialog').showModal();
}
function renderDialogs() {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="event-dialog" aria-labelledby="event-title"><form id="event-form"><h2 id="event-title">Make a little plan.</h2><p>Add an activity to someone’s week.</p><label>What’s happening?<input name="title" type="text" maxlength="70" required placeholder="e.g. Swimming lesson"></label><div class="split-grid"><label>Date<input name="date" type="date" value="${baseDate}" required></label><label>Time<input name="time" type="time" value="17:00" required></label></div><label>Who is it for?<select name="person">${people.map(name=>`<option>${name}</option>`).join('')}</select></label><label>Place or a little reminder<input name="detail" type="text" maxlength="120" placeholder="Bring a water bottle"></label><div class="dialog-actions"><button type="button" data-close>Cancel</button><button class="primary" type="submit">Add to calendar</button></div></form></dialog>
    <dialog id="event-detail" aria-labelledby="detail-title"><span id="detail-person" class="badge"></span><h2 id="detail-title" style="margin-top:18px"></h2><p id="detail-time"></p><div class="note" id="detail-note"></div><div class="dialog-actions"><button data-close>Done</button></div></dialog>
    <dialog id="task-dialog" aria-labelledby="task-title"><form id="task-form"><h2 id="task-title">A helping hand.</h2><label>Task<input type="text" name="title" required maxlength="80" placeholder="What needs doing?"></label><label>Who’s helping?<select name="person">${people.map(name=>`<option>${name}</option>`).join('')}</select></label><label>When?<input type="text" name="detail" maxlength="80" placeholder="e.g. Before dinner"></label><input type="hidden" name="kind"><div class="dialog-actions"><button type="button" data-close>Cancel</button><button type="submit" class="primary">Add task</button></div></form></dialog>
    <dialog id="security-dialog" aria-labelledby="security-title"><form id="security-form"><h2 id="security-title"></h2><p id="security-description"></p><label>Parent PIN<input type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required aria-describedby="pin-error"></label><div id="pin-error" class="form-error" hidden role="alert">Use 1234 for this demo.</div><div class="dialog-actions"><button type="button" data-close>Cancel</button><button type="submit" class="primary">Confirm change</button></div></form></dialog>
    <dialog id="timetable-dialog" class="image-dialog" aria-labelledby="timetable-title"><div class="panel-heading"><h2 id="timetable-title"></h2><button class="icon-button" data-close aria-label="Close timetable">${icon('close')}</button></div><img id="timetable-image" alt=""></dialog>
    <dialog id="smoke-dialog" aria-labelledby="smoke-title"><span class="badge warning">Needs attention</span><h2 id="smoke-title" style="margin-top:18px">Check the smoke detector.</h2><p>Entrance detector · Last seen 2 hours ago · Battery 12%. Replace the battery and test the detector locally. Its current safety status is unknown.</p><div class="dialog-actions"><button data-close>Done</button><button data-smoke-task class="primary">Add battery task</button></div></dialog>
    <div class="toast" role="status" aria-live="polite" hidden></div>`);
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, [data-timetable]');
  if (!target || target.disabled) return;
  if (target.hasAttribute('data-go')) { navigate(target.dataset.go); if (target.dataset.smartJump) { smartTab = target.dataset.smartJump; renderSmart(); } }
  if (target.hasAttribute('data-close')) target.closest('dialog').close();
  if (target.hasAttribute('data-add-event')) $('#event-dialog').showModal();
  if (target.hasAttribute('data-add-task')) { $('#task-form').reset(); $('#task-form [name=kind]').value = target.dataset.addTask; $('#task-dialog').showModal(); }
  if (target.hasAttribute('data-person')) { activePerson = target.dataset.person; renderCalendar(); }
  if (target.hasAttribute('data-calendar-mode')) { calendarMode = target.dataset.calendarMode; if (calendarMode === 'month') monthDate = `${addDays(baseDate,weekOffset*7).slice(0,7)}-01`; renderCalendar(); }
  if (target.hasAttribute('data-week')) {
    const step = Number(target.dataset.week);
    if (step === 0) { weekOffset = 0; monthDate = '2026-10-01'; }
    else if (calendarMode === 'month') { const next = new Date(`${monthDate}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + step); monthDate = next.toISOString().slice(0,10); }
    else weekOffset += step;
    renderCalendar();
  }
  if (target.hasAttribute('data-event')) {
    const item = events.find(item => item.id === Number(target.dataset.event));
    $('#detail-title').textContent = item.title; $('#detail-person').textContent = item.person;
    $('#detail-time').textContent = `${dateLabel(item.date,{weekday:'long',day:'numeric',month:'long'})} · ${item.time}`;
    $('#detail-note').textContent = item.detail || 'No extra reminders. You’re all set.';
    $('#event-detail').showModal();
  }
  if (target.hasAttribute('data-smart-tab')) { smartTab = target.dataset.smartTab; room = 'All rooms'; renderSmart(); }
  if (target.hasAttribute('data-room-filter')) { room = target.dataset.roomFilter; filterRooms(); }
  if (target.hasAttribute('data-temp')) { home.temperature = Math.min(28, Math.max(16, home.temperature + Number(target.dataset.temp))); home.away = false; home.scene = ''; syncHome(); }
  if (target.hasAttribute('data-charge')) { home.charging = !home.charging && home.chargeLimit > 72; syncHome(); notify(home.chargeLimit <= 72 ? 'Charge target already reached.' : home.charging ? 'Charging resumed in this demo.' : 'Charging paused in this demo.'); }
  if (target.hasAttribute('data-scene')) {
    const scene = target.dataset.scene;
    const [brightness,temperature,blinds] = {Morning:[80,21,100],Dinner:[60,21,75],'Movie night':[15,22,0],'Good night':[0,18,0]}[scene];
    Object.assign(home,{scene,brightness,temperature,blinds,light:brightness > 0,kitchen:scene === 'Morning' || scene === 'Dinner',away:false});
    syncHome(); notify(`${scene} set. Lights and comfort updated.`);
  }
  if (target.hasAttribute('data-secure')) openSecurity(target.dataset.secure, target.dataset.alarm);
  if (target.hasAttribute('data-timetable')) {
    const name = target.dataset.timetable;
    $('#timetable-title').textContent = `${name === 'emma' ? 'Emma' : 'Leo'}’s school week`;
    $('#timetable-image').src = `./assets/${name}-timetable.svg`; $('#timetable-image').alt = `${name}’s sample school timetable, all lessons Monday to Friday`;
    $('#timetable-dialog').showModal();
  }
  if (target.hasAttribute('data-smoke-help')) $('#smoke-dialog').showModal();
  if (target.hasAttribute('data-smoke-task')) {
    if (!tasks.some(task => task.title === 'Replace smoke detector battery' && !task.done)) tasks.push({id:`t${Date.now()}`,title:'Replace smoke detector battery',person:'Erik',done:false,kind:'tasks',detail:'Needs attention · Offline'});
    $('#smoke-dialog').close(); renderLists(); navigate('lists'); notify('Battery replacement is on your task list.');
  }
  if (target.hasAttribute('data-offline-button')) {
    $$('.sensor-status').forEach(el => { if (!offline) el.dataset.original = el.textContent; });
    offline = !offline; syncHome(); notify(offline ? 'Demo hub offline. Controls paused; family planner still works.' : 'Demo hub reconnected. Home controls ready.');
  }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.hasAttribute('data-check')) { const item = [...tasks,...shopping].find(item => item.id === el.dataset.check); item.done = el.checked; const section = el.closest('[data-view]'); renderLists(); section.querySelector(`[data-check="${item.id}"]`)?.focus({preventScroll:true}); notify(item.done ? `${item.title} · done` : `${item.title} · back on the list`); }
  if (el.hasAttribute('data-home')) {
    if (offline) { syncHome(); return; }
    const key = el.dataset.home;
    home[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
    if (key === 'away') home.temperature = home.away ? 17 : 21;
    if (['light','kitchen','brightness','kitchenBrightness','blinds','away'].includes(key)) home.scene = '';
    syncHome();
  }
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.matches('input[type=range][data-home]') && !offline) { home[el.dataset.home] = Number(el.value); home.scene = ''; syncHome(); }
  if (el.hasAttribute('data-charge-limit') && !offline) { home.chargeLimit = Number(el.value); if (home.chargeLimit <= 72) home.charging = false; syncHome(); }
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!form.matches('#event-form, #task-form, #security-form, [data-shopping-form]')) return;
  event.preventDefault();
  const data = new FormData(form);
  if (form.matches('[data-shopping-form]')) {
    const title = data.get('item').trim(); if (!title) return;
    shopping.push({id:`s${Date.now()}`,title,detail:'',done:false}); form.reset(); renderLists(); notify(`${title} added to the shopping list.`);
  }
  if (form.id === 'event-form') {
    const title = data.get('title').trim(); if (!title) return;
    const date = data.get('date');
    events.push({id:events.length,date,time:data.get('time'),person:data.get('person'),title,detail:data.get('detail').trim()});
    weekOffset = Math.floor((new Date(`${date}T12:00:00Z`) - new Date(`${baseDate}T12:00:00Z`)) / 604800000);
    activePerson = 'Everyone'; calendarMode = 'week'; renderCalendar(); form.closest('dialog').close(); form.reset(); navigate('week'); notify('Added to the family calendar.');
  }
  if (form.id === 'task-form') {
    const title = data.get('title').trim(); if (!title) return;
    tasks.push({id:`t${Date.now()}`,title,person:data.get('person'),detail:data.get('detail').trim() || 'Any time',kind:data.get('kind'),done:false});
    renderLists(); form.closest('dialog').close(); notify('Task added. A little teamwork goes a long way.');
  }
  if (form.id === 'security-form' && pendingSecurity && !offline) {
    if (data.get('pin') !== '1234') { $('#pin-error').hidden = false; return; }
    if (pendingSecurity.key === 'lock') home.locked = !home.locked;
    if (pendingSecurity.key === 'water') home.water = !home.water;
    if (pendingSecurity.key === 'alarm') { home.alarm = pendingSecurity.alarm; if (home.alarm === 'Away armed' && home.routine2) home.locked = true; }
    pendingSecurity = null; form.closest('dialog').close(); syncHome(); notify('Confirmed. Demo home updated.');
  }
});
const restoreView = () => { if (location.hash !== '#main') navigate(location.hash.slice(1), false); };
window.addEventListener('hashchange', restoreView);
window.addEventListener('popstate', restoreView);
createViews(); renderDialogs(); mountIcons(); renderLists(); renderCalendar(); syncHome(); navigate(location.hash.slice(1) || initialView, false);
