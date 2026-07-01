# NutriSnap Web

Browser-Ansicht für [NutriSnap](https://github.com/sondereggerseverin/NutriSnap), verbunden mit derselben Supabase-Datenbank wie die Android-App. Login mit den gleichen Zugangsdaten, Daten sind sofort auf beiden Seiten sichtbar.

**Phase 1 (aktuell):** Login, Tagebuch (ansehen + manuell hinzufügen/löschen), Gewichtsverlauf mit Chart, Rezepte durchsuchen (lesend).

**Geplant:** KI-Rezeptgenerator, Foto-Scanner (Essen & Nährwerttabelle), Wasser-Tracking, Fasten-Timer.

## Deployment auf Vercel (empfohlen, kostenlos)

1. Auf [vercel.com](https://vercel.com) mit GitHub-Account einloggen
2. "Add New Project" → dieses Repo (`NutriSnap-Web`) auswählen
3. Framework Preset: **Vite** (wird automatisch erkannt)
4. Unter "Environment Variables" folgende zwei Werte eintragen:

   | Name | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://hjafcgnklbsdioviprem.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | (der öffentliche anon-Key, gleicher wie in der App-Build-Config) |

5. "Deploy" klicken

Nach dem ersten Deploy baut Vercel bei jedem Push auf `main` automatisch neu — kein manueller Schritt nötig.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

## Hinweis zum Anon-Key

Der `anon`-Key ist ein öffentlicher Client-Schlüssel (steckt bereits in der APK) — kein Geheimnis. Die eigentliche Datensicherheit läuft über Row-Level-Security in Supabase, sodass jeder Nutzer nur seine eigenen Daten sieht/bearbeitet.
