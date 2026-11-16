# Intranet ZZS JčK

Moderní náhrada starého SharePointového intranetu (`intranet.zzsjck.local`).

## Struktura
- `src/index.html` – aktuální verze (jeden soubor, bez buildu)
- `src/template.html`, `src/docs.seed.json` – zdroj a výchozí data
- `legacy/` – uložená domovská stránka starého intranetu (referenční)
- `tools/export-intranet.ps1` – export celého starého intranetu (spustit na PC v síti)
- `import/` – sem patří výstup exportu (`pages/`, `files/`, `lists/`, `log.txt`)

## Postup migrace
1. Na PC v síti spustit `powershell -ExecutionPolicy Bypass -File tools\export-intranet.ps1`.
2. Rozbalit `intranet-export.zip` do složky `import/` a commitnout.
3. Podle `import/lists/*.xml` a `import/files/` naplnit nový intranet daty.

Repozitář je soukromý, protože obsahuje interní dokumenty.
