# NutriSnap Web

Browser-Ansicht für [NutriSnap](https://github.com/sondereggerseverin/NutriSnap), verbunden mit derselben Supabase-Datenbank wie die Android-App. Login mit den gleichen Zugangsdaten, Daten sind sofort auf beiden Seiten sichtbar.

**Phase 1:** Login, Tagebuch (ansehen + manuell hinzufügen/löschen), Gewichtsverlauf mit Chart, Rezepte durchsuchen.

**Phase 2 (aktuell):** KI-Koch (Rezeptgenerator, wie in der App), Essen scannen (Foto → KI-Kalorienschätzung → ins Tagebuch), Nährwerttabelle scannen (Foto → Werte pro 100g → als Tagebucheintrag).

**Geplant:** Wasser-Tracking, Fasten-Timer.

## Deployment auf Vercel (empfohlen, kostenlos)

1. Auf [vercel.com](https://vercel.com) mit GitHub-Account einloggen
2. "Add New Project" → dieses Repo (`NutriSnap-Web`) auswählen
3. Framework Preset: **Vite** (wird automatisch erkannt)
4. Unter "Environment Variables" folgende drei Werte eintragen:

   | Name | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://hjafcgnklbsdioviprem.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | (der öffentliche anon-Key, gleicher wie in der App-Build-Config) |
   | `VITE_GROQ_API_KEY` | (der gleiche Groq-Key wie im GitHub Actions Secret der App) |

5. "Deploy" klicken

Nach dem ersten Deploy baut Vercel bei jedem Push auf `main` automatisch neu — kein manueller Schritt nötig.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

## Hinweise

**Anon-Key:** Ein öffentlicher Client-Schlüssel (steckt bereits in der APK) — kein Geheimnis. Die eigentliche Datensicherheit läuft über Row-Level-Security in Supabase.

**Groq-Key im Browser:** Anders als in der App ist dieser Key im Netzwerkverkehr des Browsers sichtbar (Dev-Tools). Bewusste Entscheidung für Einfachheit in Phase 2 — für eine abgesicherte Variante könnte später ein kleiner Serverless-Proxy vorgeschaltet werden.

**Produkt-Verzeichnis:** Die Nährwerttabellen-Erkennung speichert aktuell direkt als Tagebucheintrag, nicht als wiederverwendbares Produkt — das lokale `custom_foods`-Verzeichnis der App ist (noch) nicht mit Supabase synchronisiert.
