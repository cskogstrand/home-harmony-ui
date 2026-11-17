# Family board review

Chrome rendered the production build from `59d9dce` and the feature branch against the same fictional household. The busy morning included two running appliances, a printer image and camera, a playing speaker group, two shopping lists and overlapping school plans. A second fixture had a quiet day. The home used Europe/Oslo and the browser used America/Los_Angeles.

## Matched tasks

| Family task | Before | After |
| --- | --- | --- |
| Read the next plan on a 390 × 844 phone | The activity title started 971 px down the page. | The title starts at 393 px. The full activity, owner and time range clear the playing Sonos capsule. [Phone comparison](images/family-board/phone.webp) |
| Read the board while passing the wall | The next activity started at 888 px with a 26 px title line. | It starts at 707 px with a 46 px title line. Its calendar link opens that day. [Wall comparison](images/family-board/wall.webp) |
| Compare two running appliances | The dishwasher and printer both received 429 px of width. Their cards were 163 and 356 px tall. | The cards receive 483 and 825 px. Both are 262 px tall with aligned progress bars. [Alert comparison](images/family-board/alerts.webp) |
| Activate one of three scenes | The first tile started at x = 81 on the wall and the right quarter was empty. | Three 305 px tiles center on the row, starting at x = 243 on both surfaces. [Favorites and Scenes](images/family-board/scenes.webp) |
| Add something to the weekend shopping | Two lists showed six item rows in an 806 px Today panel. Replacing the first assignment in Settings disconnected that list. | A 285 px panel shows both destinations and counts. Tapping a list’s plus opens its focused input. [Shopping comparison](images/family-board/shopping.webp) |
| Use a small control beside a camera | The light and outlet both stretched to the camera’s 356 px row height. | The light uses 243 px, the outlet 225 px and the camera retains 356 px. [Smart home comparison](images/family-board/devices.webp) |

## Browser journeys

- Linked Weekend shop alongside Groceries, set different display preferences and added Milk to both. Completing and reopening Milk targeted the selected Home Assistant entity and item. A failed add kept its draft across pages. Reload retained both assignments and preferences. An unavailable source left the other usable. Unlinking preserved its Home Assistant items.
- Opened the child’s next activity, edited its calendar event by UID and followed a dated task back to its source list. Checked the home date across month, week, day and by-person layouts with overlapping and multi-day plans. School showed its calendar agenda and both stored timetable pages. Closing the enlarged page restored focus to its opener. Homework completion updated its own list.
- Exercised banner, section, activity and compact activity on the board, Notifications and the settings preview, including a rule override. Offscreen arrivals and removals preserved reading position and unrelated focus. A disappearing focused control returned focus to the bell.
- Checked both scene surfaces with 0, 1, 3, 4, 5 and 7 scenes, a mixed group, a long label and a reversed saved order. Checked row centering and minimum 44 px tile dimensions at 1440 × 2560, 390 × 844 and 1440 × 900.
- Inspected all 39 card families in Original, Compact and Super compact, then exercised unavailable, waiting and failed gallery states. Checked live components on Today, Smart home, Areas, device detail and the card editor against fictional entities. Verified scene confirmation, pending feedback, failure, reload without replay and the alarm PIN gate.
- Opened onboarding, settings, cameras, Sonos, security, energy, devices, integrations, zones, automations and history. Checked the last action above the dock at 150% root type size on seven core screens in English and Bokmål, with global compact mode both on and off. Also exercised reduced motion, more contrast, reduced transparency, forced colors and keyboard navigation.

## Contact sheets

Each theme sheet pairs light and dark for all 12 palettes, using the same fixture. The 240 screenshots cover ten surfaces. Sampled text contrast across the simulated dock backdrops was at least 5.4 to 1.

| Family planning | Home controls and alerts |
| --- | --- |
| [Today](images/family-board/palettes.webp) | [Scenes](images/family-board/palettes/scenes.webp) |
| [Shopping](images/family-board/palettes/shopping.webp) | [Smart home](images/family-board/palettes/smart-home.webp) |
| [List assignments](images/family-board/palettes/sources.webp) | [Card editor](images/family-board/palettes/editor.webp) |
| [Calendar](images/family-board/palettes/calendar.webp) | [Notifications](images/family-board/palettes/notifications.webp) |
| [School](images/family-board/palettes/school.webp) | [Notification preview](images/family-board/palettes/preview.webp) |

The gallery sheets show all three densities for each card family. [Families 1–9](images/family-board/cards/cards-1.webp) · [10–18](images/family-board/cards/cards-2.webp) · [19–27](images/family-board/cards/cards-3.webp) · [28–36](images/family-board/cards/cards-4.webp) · [37–39](images/family-board/cards/cards-5.webp)

Physical checks remain for viewing distance, room glare, finger accuracy, the wall browser’s virtual keyboard and sustained camera playback with the actual household devices.
