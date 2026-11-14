# hackathonWoes — System Architecture & Screen Designs

**Project:** "Abandoned but not Forgotten" — an interactive archive of NASA equipment left behind on the Moon, Mars, Earth orbit, and deep space.

**Scope:** full-stack prototype, general audience. Not kid-only; age-targeted modes are roadmap.

---

## 1. The one architectural rule

**Never let the AI be the source of truth.**

Every feature splits into two layers:

| Layer | Owns | Produced by |
|---|---|---|
| **Facts** | weights, dates, power source, distance driven, status, location | deterministic reads from the master JSON |
| **Narration** | wording, tone, story beats, podcast script | the LLM, given facts as its *only* allowed input |

Consequences:

- Comparisons are true (the diff is computed, not generated).
- The chatbot cannot invent facts (it is scoped to one record).
- Quiz answers cannot be wrong (they are fields).
- "How do you prevent hallucination?" has a one-sentence answer.

If a feature cannot be split this way, cut it.

---

## 2. Screen inventory

**7 primary screens + 3 persistent overlays.**

| # | Screen | Route | Job |
|---|---|---|---|
| S1 | Home / Gateway | `/` | Pick a zone |
| S2 | Archive / Zone Explorer | `/archive?zone=` | See what is abandoned there, pick one |
| S3 | Mission Profile | `/item/:id` | Tell that machine's story |
| S4 | Story Engine | `/compare?a=&b=` | Compare two machines |
| S5 | Studio | `/studio?items=&mode=` | Turn data into audio/video |
| S6 | Mission Test | `/test?zone=` | Prove they learned it |
| S7 | Sources / About | `/sources` | Compliance + trust |

Overlays: **O1** chat drawer, **O2** mini audio player, **O3** compare tray.

### Global chrome

Top nav on every screen: Home · Archive · Compare · Test · Sources, plus a chip showing the active zone.
Bottom audio bar appears only while audio plays and persists across navigation.
Chat button appears only when an item is loaded.
No sidebars, no dashboard clutter.

---

## 3. Screen specifications

### S1 — Home / Gateway

**Purpose:** orient a cold visitor in five seconds and force one decision: which zone.

**Contents**
- Hero: title, one-line hook ("Everything we left behind is still up there."), "Start exploring"
- Four zone bodies: **Moon**, **Mars**, **Earth Orbit ("The Graveyard Belt")**, **Deep Space** — each with item count and one representative NASA image
- Live counters: total items, zones, years covered — computed from data, never hardcoded
- Three shortcut tiles: Explore · Compare · Mission Test

**Behaviour**
- Click a zone → `/archive?zone=moon`
- Hover a zone → previews three item thumbnails from that zone
- Counts come from one cached `GET /api/items`

**States**
- Skeleton cards while loading
- Empty zone is dimmed and labelled "coming soon" (honest, and shows roadmap)

---

### S2 — Archive / Zone Explorer

**Purpose:** the shelf. Everything abandoned in one zone, browsable two ways.

**Contents**
- Zone tab bar (four zones), switches content in place
- View toggle: **Map** / **Grid**
- Search, filters (era, type: rover/lander/orbiter/stage/probe), sort
- Result count: "12 of 23 shown"
- Map mode: 2D zone map, one pin per item
- Grid mode: cards with real NASA photo, name, years active, status chip
- Side preview panel on selection

**Behaviour**
- **URL is the source of truth:** `?zone=&q=&type=&view=` — back/forward work, every state is shareable
- Pin hover → tooltip; click → preview; "Open profile" → S3
- Card click → same preview panel
- Preview has two CTAs: **Open profile** and **Add to compare**
- Filters run client-side over the fetched zone payload

**States**
- Skeleton grid while loading
- "No matches" with a clear-filters button
- Broken-image fallback

**Exits:** S3 (detail), S4 (prefilled as slot A), S6 (test this zone).

---

### S3 — Mission Profile

**Purpose:** the emotional payload. This is where "abandoned but not forgotten" lands.

**Contents, top to bottom**
1. Hero — name, zone, years active, status, one NASA photo, three headline stats
2. **Scrollytelling timeline** — five chapters: *Built → Launched → Worked → Went Silent → Still There*. Scroll triggers fade/slide-in, animating stats, photo reveals
3. **Facts & specs table** — structured fields, every row carrying its source link
4. "Why it was abandoned" call-out
5. NASA image strip for this machine
6. Action row: **Ask this machine · Generate audio story · Add to compare · Take the test**
7. Sources block

**Behaviour**
- Scroll progress rail on the right so length is predictable
- Chat drawer is scoped to this item; backend hands the LLM only this record
- "Generate audio story" carries the item into S5
- "Add to compare" drops it into the compare tray (O3)

**States**
- Images lazy-load
- If the AI backend is down, chat is disabled with a friendly note — the page must still read fully and still satisfy judging

**Exits:** S4, S5, S6, chat overlay, back to S2 filtered by zone.

---

### S4 — Story Engine

**Purpose:** the differentiator. Two machines, one true comparison.

**Contents**
- Two searchable selectors (A and B) with thumbnail slots and a swap button
- **Depth toggle: Simple / Deep**
  - Simple = one narrative for a general audience
  - Deep = narrative plus a full attribute diff table
- Output: headline, streaming narrative, then two columns — **shared traits** / **differences**, every row sourced
- "Turn this into audio" and "Take the test" CTAs

**Behaviour**
- Select A and B, or arrive prefilled from S2/S3 → Generate
- Backend computes the diff from JSON, then asks the LLM to narrate only that diff
- Changing depth regenerates; results cached per pair+depth
- Fully deep-linkable: `/compare?a=...&b=...`

**States**
- Generate disabled until both slots are filled
- Skeleton lines during generation
- Error keeps selections so retry is one click

**Exits:** S3 (click either name), S5 (audio of the comparison), S6.

---

### S5 — Studio

**Purpose:** turn facts into a NotebookLM-style artifact without generating real video.

**Contents**
- "What this will be built from" — the exact items and facts about to be used
- Mode toggle: **Audio / Video**
- Voice option: single narrator or two-host
- Generate button with staged progress (script → voices → stitch)
- Player: audio bar, or video box with Ken-Burns NASA photos and captions
- Provenance banner: *Narration AI-generated · Imagery NASA (public domain)*
- Download / copy-link

**Behaviour**
- Audio = LLM script from JSON facts → TTS per line → stitch to mp3 → `<audio>`
- Video = play that mp3 over 4–5 real NASA photos with pan/zoom and burned-in captions. Documentary feel, renders in seconds, costs nothing
- If TTS fails, fall back to displaying the script as text

**Exits:** back to S3 or S4, or forward to S6.

---

### S6 — Mission Test

**Purpose:** retrieval practice dressed as a game. The only screen that proves learning happened.

**Contents**
- Setup: choose a zone, or arrive deep-linked to "test what I just read"
- Question screen: progress ("3 / 5"), question, options, plus one interactive challenge type (dust the solar panels / reconnect the antenna)
- Feedback: correct → show the sourced fact; wrong → same fact highlighted, one point lost, nothing punitive
- End: **Mission Report** — score, streak, missed concepts, links to those items, share button

**Behaviour**
- Questions generated from JSON fields only, so they cannot be wrong
- Keyboard 1–4 supported for demo speed
- Score POSTed to the session at the end
- "Missed concepts" link back into S2/S3, closing the learning loop

**States**
- No questions for a zone → suggest the nearest zone
- Save fails → still show the score locally

---

### S7 — Sources / About

**Purpose:** the compliance screen that also builds trust.

**Contents:** what the project is · the challenge and Resources tab link · per-item source list · explicit "data vs. AI-generated" disclosure · credits.

---

### Overlays

| ID | Overlay | Behaviour |
|---|---|---|
| O1 | Chat drawer | Right-side panel, scoped to the current item. Out-of-scope questions get "I only know what is in the mission log." |
| O2 | Mini audio player | Bottom bar, persists across navigation, survives route changes |
| O3 | Compare tray | Floating chip, shows "2 selected → Compare", one click to S4 |

---

## 4. How the screens work together

**Shared state** (one small store): `{ zone, compareA, compareB, sessionId, nowPlaying }`.
Everything else travels in the URL, so screens stay independent and links stay shareable.

**Three journeys**

1. **Explorer** — S1 → S2 (zone) → S3 (profile) → chat / S5 → back
2. **Comparer** — S1/S2 → S4 → S3 (either machine) → S5
3. **Learner** — S3 → S6 (deep-linked) → Mission Report → S2 filtered by missed concept

**Navigation map**

```
                ┌──────────────┐
                │ S1 Home      │
                └──────┬───────┘
        ┌──────────────┼───────────────┐
        v              v               v
   ┌─────────┐    ┌──────────┐   ┌─────────┐
   │ S2      │───>│ S4       │   │ S6      │
   │ Archive │    │ Compare  │   │ Test    │
   └────┬────┘    └────┬─────┘   └────┬────┘
        v              v              │
   ┌─────────────────────────┐        │
   │ S3 Mission Profile      │<───────┘ (missed concepts)
   │   ├─ O1 chat drawer     │
   │   └─ actions ──> S5     │
   └─────────────────────────┘
                S5 Studio (audio/video)
                S7 Sources (reachable everywhere)
```

**The unifying rule:** all seven screens read the same JSON records through the same API. Facts are computed deterministically and only *handed to* the LLM — never fetched *by* it.

---

## 5. Data model (master JSON)

```jsonc
{
  "id": "opportunity-rover",
  "name": "Opportunity (MER-B)",
  "zone": "mars",                          // moon | mars | earth-orbit | deep-space
  "type": "rover",                         // rover | lander | orbiter | stage | probe
  "location": { "label": "Meridiani Planum", "lat": -1.95, "lon": 354.47 },
  "years_active": "2004-2018",
  "status": "inactive",
  "abandonment_reason": "Global dust storm blocked solar panels",
  "specs": { "mass_kg": 185, "power": "solar", "distance_km": 45.16 },
  "facts": [
    "Planned for a 90-day mission, but survived nearly 15 Earth years.",
    "Drove 28.06 miles (45.16 km), an off-world driving record.",
    "Lost contact in June 2018 after a planet-wide dust storm blocked its solar panels."
  ],
  "nasa_search_query": "Opportunity rover Mars",
  "source_urls": ["https://science.nasa.gov/mission/mer-opportunity/"],
  "story": { "simple": "...", "deep": "..." }
}
```

| Field | Drives |
|---|---|
| `zone` | Home gateway, Archive tabs |
| `location` | Map pins |
| `specs` | Compare diff table |
| `facts` | Chat, podcast script, quiz |
| `nasa_search_query` | NASA Image API pipeline |
| `source_urls` | Judging compliance, visible citations |

Target 25–40 items. Do not chase 200.

---

## 6. API surface

| Endpoint | Does |
|---|---|
| `GET /api/items?zone=` | Filtered list |
| `GET /api/items/:id` | Full record |
| `GET /api/images?q=` | Proxies the NASA Image API (keeps rate limiting server-side) |
| `POST /api/chat` | `{ itemId, message }` → grounded answer |
| `POST /api/compare` | `{ aId, bId, depth }` → diff + narrative |
| `POST /api/story/audio` | `{ itemIds }` → mp3 URL |
| `POST /api/quiz` | `{ zone }` → 5 questions |
| `POST /api/quiz/score` | Saves score to session |

---

## 7. Stack

- **Next.js (App Router)** — pages and API routes in one repo; fastest for a mixed team
- **Python FastAPI sidecar** only if someone is Python-strong and wants the audio stitching there; otherwise stay single-runtime
- **LLM + TTS** via one provider, key stored server-side
- **NASA Image API** — free, no key, but proxy it anyway
- **No database.** JSON file in repo, in-memory session map. A prototype does not need Postgres; adding it burns hours you do not have

---

## 8. Build order (tracer bullets)

1. Master JSON with 8 items + Sources footer — nothing works without it
2. Home gateway → Archive grid with real images
3. Mission Profile, static first
4. `/api/compare` diff + prose → Story Engine
5. Scrollytelling animation on the profile
6. Quiz generator → Mission Test
7. Map pins per zone
8. Chat drawer
9. Studio (audio/video) — **last; most likely to eat a day**
10. Polish and demo script

**Cut order if time runs out:** Studio → Chat → Map view.
**Never cut:** Compare and the quiz — those are the differentiators.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Scope creep across 7 screens | S1–S4 is the demo. Everything else is "roadmap" |
| AI-generated visuals must be watermarked | Use none. Real NASA imagery + Ken Burns means the rule never applies |
| Challenge requires a visible NASA source from the Resources tab | Persistent Sources footer + per-fact links, treated as a feature |
| LLM cost/latency during live demo | Cache compare results per pair+depth; pre-generate one audio sample before judging |
| Backend down mid-demo | Every screen must still render and be readable without AI |

---

## 10. Execution plan — 4 people

Assumes two people comfortable with React/Next, one strongest on backend/prompting, one happy doing data and content. If that is wrong, swap lanes B and C — they are the most interchangeable.

| | Lane | Screens owned (DRI) | Why this cut |
|---|---|---|---|
| **A** | **Data & Platform** | S7 + global shell + all API scaffolding | Unblocks everyone in hour one; nobody else can start without the JSON contract |
| **B** | **Browse** | S1, S2, O3 | Self-contained, demo-facing, no LLM dependency |
| **C** | **Story** | S3, O1, O2 | The emotional payload plus the chat that lives on it |
| **D** | **Engines** | S4, S6 | Both are pure "facts layer" features over the same JSON — same brain, same code |
| **shared** | **Studio** | S5 | Cut-last, not on the critical path. Assigned only when someone is free |

### Phase 0 — everyone, first 60 minutes (together, not in parallel)

Teams skip this and lose four hours to it. Lock these before anyone writes UI:

1. **JSON schema frozen** — the object in §5, agreed field by field
2. **API shapes frozen** — the 8 endpoints, request/response as TypeScript types in one shared file
3. **Route map frozen** — the 7 routes and their query params
4. **One branch each, PR into `main`, A merges.** No one edits another person's files
5. **Deploy target live on day one** — a real URL before hour two

If the schema is not frozen, A cannot fill data, B cannot render cards, C cannot build chat context, and D cannot build the diff. Everything stalls behind one argument.

### Phase 1 — skeleton (first ~6 hours)

| A | B | C | D |
|---|---|---|---|
| JSON with 8 real items | Shell: nav, footer, zone chip, routing | S3 layout, static, real data | `/api/compare` diff, tested with curl |
| NASA image proxy `/api/images` | S1 Home gateway | S3 facts table + sources block | `/api/quiz` generator |
| Shared TS types + API stubs returning mocks | S2 Archive grid | Chat API stub endpoint | Quiz scoring + session |

**Checkpoint:** the app is navigable end-to-end on mock data. Ugly is fine. If it is not navigable, cut a screen now.

### Phase 2 — real features (~6–16h)

| A | B | C | D |
|---|---|---|---|
| Expand JSON to 25–40 items | S2 map view (pins) | Scrollytelling (`IntersectionObserver`) | S4 UI + streaming narrative |
| S7 Sources screen | S2 filters, search, URL state | O1 chat drawer + grounding prompt | S6 question flow + feedback |
| Citation / provenance component | O3 compare tray | O2 audio player bar | S6 Mission Report + score save |
| Seed data for all 4 zones | Mobile pass on S1/S2 | Chat scoped to one item | Diff table rendering |

### Phase 3 — integration and polish (~16–24h)

- **A:** deploy hygiene, image fallbacks, empty states, performance
- **B:** map polish, hover previews, keyboard navigation
- **C:** scrollytelling timing, chat out-of-scope handling
- **D:** quiz variety (add the interactive challenge type), cache compare results
- **Whoever is free:** S5 Studio. C owns the audio (they own O2); B cuts the Ken Burns video once S2 is done

### Phase 4 — demo prep

Everyone writes their own 60-second script slice; A runs the full run-through twice on the deployed URL. **Pre-generate one audio sample before judging** so nothing waits on live TTS.

### Dependency graph

```
        Phase 0 contracts
               │
        A: JSON ──────┬──────────┬──────────┐
                      v          v          v
                   B: S1/S2   C: S3      D: S4/S6
                      │          │          │
                      └──────────┴──────────┘
                                 │
                            S5 (cut-last)
```

**Critical path:** JSON → S2 → S3 → S4. A and B must not slip; C and D have slack because their backends can be stubbed.

### Where this breaks

- **A is a single point of failure.** Their first job is the 8-item JSON, not the proxy. Ship it before anything else.
- **B and D both touch cards.** D's compare selectors reuse B's card component, never clone it. Agree in Phase 0.
- **C is the loneliest lane.** Chat plus scrollytelling is the least parallelisable work. If it drags, B takes the map and hands C's scope to A once S7 is done.
- **Do not let Studio start before Phase 3.** It is the one feature that can swallow a whole person for one wow moment.
