# 🏀 Shoe Mileage Monitor

Track how many hours you play basketball in a specific pair of shoes so you know
exactly when the foam cushion memory is gone and the grip is wearing out.

The app logs every court session, keeps a **running history of foam compression
time** per shoe, and throws up a **highly visible warning** once any pair passes
**50 hours** of play.

It's a responsive, mobile-first single page web app built with plain **HTML,
CSS, and vanilla JavaScript** — no frameworks, no build step, no internet
connection required. All of your data is saved locally in the browser.

---

## Features

- 📱 **Native-app feel** — mobile-first layout framed like a handset on desktop.
- 👟 **Add pairs & log sessions** — clean inputs for shoe name/brand and court hours.
- ⏱️ **Automatic wear tracking** — every session adds to a per-shoe running total.
- 📊 **At-a-glance status** — progress bar and colour zones (Fresh → Breaking in →
  Almost done → Worn out).
- ⚠️ **50-hour alert** — a bold banner warns you when the memory and grip are gone.
- 💾 **Offline storage** — data persists in your browser via the localStorage API.
- 🛡️ **Error handling** — typing letters instead of numbers won't break anything;
  you get a friendly inline message instead.

---

## How to open and test it locally

You have two options. **Option A needs nothing but a browser.**

### Option A — Just open the file (simplest)

1. Download / clone this repository.
2. Double-click **`index.html`** (or drag it into your browser).

That's it — the app runs entirely in the browser and saves data on your device.

### Option B — Run a tiny local server (closest to a real phone)

Some browsers are stricter about local files. Serving the folder avoids any
such quirks and lets you preview it from your phone on the same Wi-Fi.

From the project folder, run **one** of these:

```bash
# Python 3 (pre-installed on macOS / most Linux)
python3 -m http.server 8000

# …or Node.js
npx serve .
```

Then open **http://localhost:8000** in your browser.

> **Preview on your actual phone:** with the Python server running, find your
> computer's local IP (e.g. `192.168.1.20`) and visit
> `http://192.168.1.20:8000` from your phone on the same network.

### Try it out

1. Add a pair (e.g. *"Kobe 6 Protro"*, brand *"Nike"*).
2. Tap **+ Log session** and enter some hours (e.g. `2.5`).
3. Keep logging sessions until the total crosses **50 hours** — the big red
   **worn-out warning** appears at the top and on the card.
4. Reload the page — your data is still there (saved locally).
5. Try typing letters in the hours box to see the error handling in action.

---

## Project structure

The code is intentionally split into small, single-purpose files. Each layer is
independent, which keeps the logic reusable when this app is later wrapped into
a **native mobile app**.

```
Shoe-mileage/
├── index.html          # Page STRUCTURE only
├── css/
│   └── styles.css      # All styling (mobile-first)
└── js/
    ├── storage.js      # PERSISTENCE  — the only file that touches localStorage
    ├── data.js         # LOGIC        — pure calculations & validation (no DOM)
    ├── ui.js           # RENDERING    — draws the screen (no business rules)
    └── app.js          # CONTROLLER   — wires storage + data + ui together
```

### Why this separation matters

The **data processing logic is completely separate from the UI rendering
logic**, as follows:

| Layer         | Knows about the DOM? | Knows about storage? | Role |
|---------------|:--------------------:|:--------------------:|------|
| `storage.js`  | ❌ | ✅ | Read/write the saved dataset |
| `data.js`     | ❌ | ❌ | Totals, wear %, 50-hour rule, input validation |
| `ui.js`       | ✅ | ❌ | Turn data into pixels |
| `app.js`      | ✅ | ✅ | Orchestrate the above |

Because `data.js` is pure logic and `storage.js` is the single point of
persistence, porting to native later mostly means **swapping the storage engine
and re-skinning the UI** — the rules never change.

---

## Configuration

The wear threshold lives in one place. To change it, edit the constant near the
top of **`js/data.js`**:

```js
var WEAR_THRESHOLD_HOURS = 50; // hours before the foam memory is considered gone
```

Everything else (progress bars, percentages, warning copy) updates automatically.

---

## Notes

- Data is stored **per browser, per device** — it isn't synced to the cloud.
- Clearing your browser's site data will erase your logged shoes.
- No data ever leaves your device; the app makes no network requests.
