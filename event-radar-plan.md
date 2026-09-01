# Event Radar — načrt za Claude Code

**Kako uporabiti:** to datoteko odloži v prazen projekt in Claude Code-u reci:
*"Zgradi in poženi projekt, opisan v `event-radar-plan.md`. Sledi razdelku »Vrstni red gradnje«. Na CHECKPOINT-u se ustavi in počakaj name."*

---

## 1. Cilj

Večagentni cevovod, ki za izbran **kraj + okolico** in **časovno okno** zbere
kulturne, športne in glasbene dogodke, jih očisti, opiše, oceni po odmevnosti
in izpiše razvrščen pregled (`out/digest.md` + koledar `out/events.ics`).
Delo je razdeljeno na **vzporedno plast iskanja** (3 scouti hkrati) in
**zaporedno plast obdelave** (curator → analyst → compiler).

## 2. Runtime parametri — `config.json`

```json
{
  "kraj": "Ljubljana",
  "vkljuci_naselja": ["Domžale", "Kamnik", "Vrhnika", "Medvode", "Grosuplje"],
  "radij_km": 25,
  "okno": { "od": "today", "dni": 7 },
  "kategorije": ["glasba", "kultura", "sport"],
  "razvrsti_po": "odmevnost"
}
```

`okno.od` sprejme `"today"` ali ISO datum; orkestrator razreši v `od`/`do` (ISO).
`vkljuci_naselja` je poceni nadomestek za geokodiranje (glej Omejitve).

## 3. Arhitektura

```
orchestrator (CLAUDE.md)
 ├─(VZPOREDNO)→ culture-scout → data/raw/kultura.json
 │              sports-scout  → data/raw/sport.json
 │              music-scout   → data/raw/glasba.json
 ├→ curator   (bere raw/*)  → data/clean/events.json   ← CHECKPOINT
 ├→ analyst   (bere clean)  → data/scored/events.json
 └→ compiler  (bere scored) → out/digest.md (+ out/events.ics)
```

Scouti tečejo hkrati (fan-out), ker so iskanja neodvisna. 4→5→6 zaporedno,
ker vsak korak potrebuje izhod prejšnjega. Vsak podagent piše v datoteko in
vrne le **pot + število zapisov** (velik JSON ne gre skozi povzetkovni kanal).

## 4. Struktura repozitorija

```
event-radar/
├─ CLAUDE.md
├─ config.json
├─ schema/event.schema.json
├─ .claude/
│  ├─ agents/
│  │  ├─ culture-scout.md
│  │  ├─ sports-scout.md
│  │  ├─ music-scout.md
│  │  ├─ curator.md
│  │  ├─ analyst.md
│  │  └─ compiler.md
│  └─ commands/radar.md        # opcijsko: /radar
├─ data/  (raw|clean|scored — generira cevovod)
└─ out/   (digest.md, events.ics — generira cevovod)
```

## 5. Podatkovna pogodba — `schema/event.schema.json`

Vsak dogodek je objekt s temi polji (scouti napolnijo prvih ~8, analyst doda
`opis` + `odmevnost`):

```json
{
  "id": "sha1(naslov|datum|prizorisce)",
  "kategorija": "glasba|kultura|sport",
  "naslov": "string",
  "datum": "YYYY-MM-DD",
  "ura": "HH:MM | null",
  "prizorisce": "string",
  "kraj": "string",
  "viri": ["url"],
  "opis": "1–2 stavka: kaj / kje / kdaj / kdo",
  "odmevnost": {
    "skupaj": 0,
    "doseg": 0, "prepoznavnost": 0, "obisk": 0,
    "redkost": 0, "medijski_signal": 0
  },
  "znacke": ["string"]
}
```

## 6. Rubrika odmevnosti (za analyst)

Vsaka dimenzija 0–5, utežena vsota normalizirana na 0–100:

| Dimenzija | Utež | Lestvica |
|---|---|---|
| doseg | 30 % | lokalno=1 · regijsko=3 · nacionalno=4 · mednarodno=5 |
| prepoznavnost | 25 % | neznani=1 · znani lokalno=3 · uveljavljeni=5 |
| obisk / kapaciteta | 20 % | <100=1 · ~500=3 · >2000=5 |
| redkost | 15 % | reden tedenski=1 · letni=3 · enkraten=5 |
| medijski_signal | 10 % | 1 vir=1 · več virov=3 · razprodano/veliko odmeva=5 |

`skupaj = round(20 * Σ(utež_i * ocena_i) / 5)`. Oceno tretiraj kot **relativno
razvrstitev znotraj nabora**, ne kot absolutno resnico.

## 7. Definicije agentov (`.claude/agents/*.md`)

### Skupna predloga za scoute
Ustvari **tri** datoteke iz te predloge; razlikujejo se le v `name`,
`{KATEGORIJA}` in seznamu seed-virov iz tabele spodaj.

```markdown
---
name: {music|culture|sports}-scout
description: MUST BE USED to find {KATEGORIJA} events for a given place and date
  window. Returns only a file path and a count.
tools: WebSearch, WebFetch, Write
model: sonnet
---
Poišči {KATEGORIJA} dogodke.
Parametri (dani v pozivu): kraj, vkljuci_naselja[], radij_km, od, do.

Iskanje:
- Uporabi seed-vire: {SEEDS}. Dodaj splošna iskanja po kraju + datumu.
- Zajemi SAMO dogodke z datumom med `od` in `do` (vključno) v kraju ali v
  katerem od `vkljuci_naselja`.

Za vsak dogodek izlušči: naslov, datum (YYYY-MM-DD), ura, prizorišče, kraj, vir(i).
NE piši opisa, NE ocenjuj, NE deduplikaj — to počneta curator in analyst.
Vsak zapis: kategorija = "{KATEGORIJA}".

Izhod: zapiši polje objektov v data/raw/{KATEGORIJA}.json (UTF-8).
Vrni SAMO: "data/raw/{KATEGORIJA}.json — N dogodkov".
```

| Agent | {KATEGORIJA} | {SEEDS} |
|---|---|---|
| music-scout | glasba | Eventim.si, Mojekarte.si, Kino Šiška, Cankarjev dom, Napovednik.si, prizorišča |
| culture-scout | kultura | Napovednik.si, Visit Ljubljana, muzeji/galerije, gledališča, Kinodvor, občinski koledarji |
| sports-scout | sport | NZS/KZS/OZS koledarji, Stožice, lokalni klubi, tekaški/kolesarski dogodki, občinski športni koledarji |

### `curator.md`

```markdown
---
name: curator
description: MUST BE USED after scouts to merge, deduplicate, and filter raw
  event files by place and date. Returns a file path and counts.
tools: Read, Write
model: sonnet
---
Vhod (dan v pozivu): poti do data/raw/*.json, kraj, vkljuci_naselja[], od, do.

1) Preberi vse tri raw datoteke in jih združi.
2) Dedup: isti dogodek = enak (normaliziran naslov + datum + prizorišče).
   Pri dvojniku obdrži enega in združi `viri`. Dodeli `id` = sha1(naslov|datum|prizorisce).
3) Filter: obdrži le dogodke z `od <= datum <= do` IN `kraj` ∈ {kraj} ∪ vkljuci_naselja.
4) Odvrzi zapise brez naslova ali datuma.

Izhod: data/clean/events.json.
Vrni: števila po korakih — {raw_skupaj, po_dedup, po_filtru} + pot.
```

### `analyst.md`

```markdown
---
name: analyst
description: MUST BE USED to write a short description and compute a notability
  score for each cleaned event, per the rubric. Returns a file path.
tools: Read, Write
model: sonnet
---
Vhod: data/clean/events.json.

Za vsak dogodek:
- `opis`: 1–2 nevtralna stavka (kaj / kje / kdaj / kdo). Brez hvalisanja.
- `odmevnost`: oceni 5 dimenzij (doseg, prepoznavnost, obisk, redkost,
  medijski_signal) po lestvici 0–5 iz rubrike; `skupaj` = round(20 * Σ(w_i*o_i)/5),
  z utežmi doseg .30, prepoznavnost .25, obisk .20, redkost .15, medijski_signal .10.
- `znacke`: 0–3 kratke oznake (npr. "mednarodni izvajalec", "razprodano", "brezplačno").

Ne izmišljaj si dejstev; če podatka ni, oceni konservativno in dodaj značko "neznano".
Izhod: data/scored/events.json (isti zapisi + opis + odmevnost + znacke).
Vrni: pot + število ocenjenih dogodkov.
```

### `compiler.md`

```markdown
---
name: compiler
description: MUST BE USED last to rank scored events and render the final digest
  and calendar. Returns the output paths.
tools: Read, Write
model: sonnet
---
Vhod: data/scored/events.json, razvrsti_po ("odmevnost" | "datum").

1) Razvrsti: odmevnost → po odmevnost.skupaj padajoče; datum → naraščajoče.
2) out/digest.md:
   - Naslov + obseg (kraj, od–do, št. dogodkov).
   - Sekcije po kategoriji; znotraj razvrščeno kot zgoraj.
   - Vrstica dogodka: **naslov** — datum ura, prizorišče (kraj) · odmevnost N/100
     \n  opis \n  [značke] \n  vir.
   - Na vrhu "TOP 5 po odmevnosti".
3) out/events.ics: veljaven VCALENDAR, en VEVENT na dogodek (DTSTART iz datum+ura,
   SUMMARY=naslov, LOCATION=prizorišče, kraj, URL=prvi vir).
Vrni: poti do obeh datotek + št. dogodkov.
```

## 8. Orkestracija — `CLAUDE.md`

```markdown
# Event Radar — orchestrator

Poženeš cevovod DETERMINISTIČNO po korakih. Ne delegiraj oportunistično.

## 1. Parametri
Preberi config.json. Razreši okno → `od`,`do` (ISO). "today" = današnji datum.

## 2. Scout (VZPOREDNO)
V ENEM sporočilu sproži TRI Agent klice hkrati: culture-scout, sports-scout,
music-scout. Vsakemu v pozivu podaj: kraj, vkljuci_naselja, radij_km, od, do.
Počakaj, da vsi trije vrnejo pot + število.

## 3. Curate
Sproži curator s tremi raw potmi + kraj, vkljuci_naselja, od, do.

## >>> CHECKPOINT <<<
Poročaj: število po kategorijah (raw), po dedupu, po filtru. USTAVI SE in
počakaj na mojo potrditev, preden nadaljuješ.

## 4. Analyze
Sproži analyst z data/clean/events.json.

## 5. Compile
Sproži compiler z data/scored/events.json + razvrsti_po iz configa.

## 6. Predstavi
Povzemi: skupno št., TOP 5 po odmevnosti, pot do out/digest.md.
```

Opcijsko `.claude/commands/radar.md` (da poženeš z `/radar`):
```markdown
Poženi Event Radar cevovod po CLAUDE.md od koraka 1 do 6.
```

## 9. Vrstni red gradnje (za Claude Code)

1. Ustvari drevo iz razdelka 4 + `config.json` (razdelek 2) + shemo (razdelek 5).
2. Zapiši 6 datotek agentov (razdelek 7) in `CLAUDE.md` (razdelek 8).
3. **Suhi test scoutov:** poženi samo korak 2 orkestracije na privzetih parametrih;
   preveri, da `data/raw/*.json` obstajajo in vsebujejo veljavne zapise.
   Če je priklic slab, dopolni seed-vire v scoutih in ponovi. **(odločitvena točka)**
4. Poženi cel cevovod do CHECKPOINT-a; poročaj števila in počakaj.
5. Po potrditvi dokončaj analyst + compiler → `out/digest.md`, `out/events.ics`.
6. Preveri po sprejemnih kriterijih (razdelek 10).

## 10. Sprejemni kriteriji

- `out/digest.md` obstaja in vsebuje ≥ 1 dogodek za privzeti primer.
- Vsak dogodek ima `opis` in `odmevnost.skupaj` ∈ [0, 100].
- Ni podvojenih `id`.
- Vsi dogodki so znotraj [`od`, `do`] in v `kraj` ∪ `vkljuci_naselja`.
- Razvrščeno po `razvrsti_po`; na vrhu TOP 5.
- `out/events.ics` se uvozi v koledar brez napak.

## 11. Omejitve (vgradi vnaprej)

- V SI ni enotnega registra dogodkov → pokritost neenakomerna; majhni/lokalni
  dogodki podreprezentirani. Kakovost je odvisna od seed-virov v scoutih.
- Podatki mesec vnaprej so redki; teden je zanesljivejši.
- `vkljuci_naselja` je približek okolice. Za pravi radij zamenjaj filter v
  curatorju z geokodiranjem (koordinate prizorišča + haversine do `kraj`).
- Dedup je mehak; robni primeri (isti dogodek, drugo ime) uidejo.
- Strošek/latenca: 6 agentov × iskanja; vzporednost zniža latenco, ne stroška.
  Za nižji strošek daj scoutom `model: haiku`, analystu pusti `sonnet`.
```
