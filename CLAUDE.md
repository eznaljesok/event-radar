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
