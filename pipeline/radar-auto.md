Poženi Event Radar cevovod NENADZOROVANO (brez ustavljanja).

Delaj DETERMINISTIČNO po korakih. Ne postavljaj vprašanj, ne čakaj potrditve.
Če kak korak ne uspe, to zabeleži in nadaljuj z ostalimi; na koncu izpiši status.

## 1. Parametri
Preberi `config.json`. Razreši `okno` → `od`,`do` (ISO). "today" = današnji datum.

## 2. Scout (VZPOREDNO)
V ENEM sporočilu sproži TRI Agent klice hkrati: `culture-scout`, `sports-scout`,
`music-scout`. Vsakemu v pozivu podaj: kraj, vkljuci_naselja, radij_km, od, do,
in absolutno izhodno pot `data/raw/<kategorija>.json`. Počakaj vse tri.

## 3. Curate  (deterministično, brez podagenta)
Poženi prek Bash:  `node pipeline/curator.js`
Skripta prebere `data/raw/*.json` in zapiše `data/clean/events.json`.
Če vrne izhodno kodo ≠ 0 (npr. 0 raw zapisov), USTAVI cevovod in javi napako —
obstoječih `data/clean|scored` in `out/` NE spreminjaj.

## 4. Analyze
Sproži `analyst` podagenta z `data/clean/events.json`. Zapiše `data/scored/events.json`.

## 5. Compile  (deterministično, brez podagenta)
Poženi prek Bash:  `node pipeline/compiler.js`
Zapiše `out/digest.md` in `out/events.ics`.

## 6. Status
Izpiši eno vrstico: število dogodkov, okno (od–do), in ali obe izhodni datoteki obstajata.
