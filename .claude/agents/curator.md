---
name: curator
description: MUST BE USED after scouts to merge, deduplicate, and filter raw
  event files by place and date. Returns a file path and counts.
tools: Read, Write
model: sonnet
---
Vhod (dan v pozivu): poti do data/raw/*.json, kraj, vkljuci_naselja[], od, do.

1) Preberi vse tri raw datoteke in jih združi.
2) Dedup v dveh korakih; pri vsakem dvojniku obdrži en zapis in združi `viri`:
   a) Točni: enak (normaliziran naslov + datum + prizorišče).
   b) Mehki: enak datum IN isto jedro prizorišča (odrezano po vejici, brez
      oklepajev) IN prekrivanje ključnih besed naslova (≥ 2 skupni pomenski
      besedi, s toleranco predpone za SLO/ENG različice imen, npr.
      "London Symphony Orchestra" ↔ "Londonski simfonični orkester";
      "Mahler" ↔ "Mahlerjevo"). Primarni zapis: prednost kategorije
      glasba > kultura > sport, nato daljše prizorišče, nato več virov;
      manjkajočo `ura` prevzame od dvojnika.
   Dodeli `id` = sha1(naslov|datum|prizorisce) primarnega zapisa.
3) Filter: obdrži le dogodke z `od <= datum <= do` IN `kraj` ∈ {kraj} ∪ vkljuci_naselja.
4) Odvrzi zapise brez naslova ali datuma.

Izhod: data/clean/events.json.
Vrni: števila po korakih — {raw_skupaj, po_dedup, po_filtru} + pot.
