import { useEffect, useMemo, useRef, useState } from 'react'
import { RecipeRow } from '../lib/types'

/** Extrahiert eine fuehrende Mengenangabe am Zeilenanfang und skaliert sie um `factor`.
 *  Spiegelt scaleIngredientLine() aus CookingModeScreen.kt. */
function scaleIngredientLine(line: string, factor: number): string {
  const match = line.match(/^\s*(\d+\/\d+|\d+(?:[.,]\d+)?)(\s*)(.*)$/s)
  if (!match) return line
  const [, numStr, spacer, rest] = match
  let value: number
  if (numStr.includes('/')) {
    const [n, d] = numStr.split('/').map(Number)
    if (!d) return line
    value = n / d
  } else {
    value = Number(numStr.replace(',', '.'))
  }
  if (Number.isNaN(value)) return line
  const rounded = Math.round(value * factor * 100) / 100
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toString().replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
  return `${formatted}${spacer}${rest}`
}

/** Erkennt eine im Kochschritt genannte Dauer, spiegelt detectDurationSeconds() aus CookingStepTimer.kt. */
function detectDurationSeconds(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(sekunden?|sek\.?|minuten?|min\.?|stunden?|std\.?|h\b)/i)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  const unit = match[2].toLowerCase()
  let seconds: number
  if (unit.startsWith('sek')) seconds = value
  else if (unit.startsWith('min')) seconds = value * 60
  else if (unit.startsWith('std') || unit === 'h') seconds = value * 3600
  else return null
  return Math.min(Math.max(Math.round(seconds), 5), 4 * 3600)
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StepTimer({ initialSeconds }: { initialSeconds: number }) {
  const [total, setTotal] = useState(initialSeconds)
  const [remaining, setRemaining] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = window.setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false)
            setFinished(true)
            if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400])
            return 0
          }
          return r - 1
        })
      }, 1000)
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current)
      }
    }
  }, [running, remaining > 0])

  const notStarted = !running && !finished && remaining === total

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        textAlign: 'center',
        background: finished ? 'var(--bg-elevated)' : undefined,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700 }}>{finished ? 'Fertig! ⏰' : formatTime(remaining)}</div>
      {notStarted && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
          <button
            className="btn-ghost btn"
            type="button"
            onClick={() => {
              const v = Math.max(total - 60, 5)
              setTotal(v)
              setRemaining(v)
            }}
          >
            −1 min
          </button>
          <button
            className="btn-ghost btn"
            type="button"
            onClick={() => {
              const v = total + 60
              setTotal(v)
              setRemaining(v)
            }}
          >
            +1 min
          </button>
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        {finished ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setFinished(false)
              setRemaining(total)
            }}
          >
            Zurücksetzen
          </button>
        ) : (
          <>
            <button className="btn" type="button" onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : remaining < total ? 'Weiter' : 'Start'}
            </button>
            {(remaining < total || running) && (
              <button
                className="btn-ghost btn"
                type="button"
                style={{ marginLeft: 10 }}
                onClick={() => {
                  setRunning(false)
                  setRemaining(total)
                }}
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CookingMode({ recipe, onClose }: { recipe: RecipeRow; onClose: () => void }) {
  const steps = useMemo(
    () =>
      (recipe.instructions || '')
        .split('\n')
        .filter((l) => l.trim())
        .map((s, i) => s.trim().replace(new RegExp(`^${i + 1}\\.\\s*`), '')),
    [recipe.instructions]
  )
  const ingredients = useMemo(() => (recipe.ingredients || '').split('\n').filter((l) => l.trim()), [recipe.ingredients])

  const baseServings = Math.max(recipe.servings || 1, 1)
  const [servings, setServings] = useState(baseServings)
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [showIngredients, setShowIngredients] = useState(false)

  const factor = servings / baseServings
  const scaledIngredients = useMemo(() => ingredients.map((l) => scaleIngredientLine(l, factor)), [ingredients, factor])

  const stepText = steps[currentStep] ?? ''
  const stepDuration = useMemo(() => detectDurationSeconds(stepText), [stepText])

  function toggleCompleted(i: number) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="scanner-overlay" style={{ alignItems: 'stretch', padding: 0 }}>
      <div
        className="scanner-panel"
        style={{ maxWidth: 640, width: '100%', margin: 'auto', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="scanner-head">
          <span>👨‍🍳 Kochmodus — {recipe.title}</span>
          <button className="scanner-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className={showIngredients ? 'btn-ghost btn' : 'btn'} type="button" onClick={() => setShowIngredients(false)}>
            Schritte
          </button>
          <button className={showIngredients ? 'btn' : 'btn-ghost btn'} type="button" onClick={() => setShowIngredients(true)}>
            🛒 Zutaten
          </button>
        </div>

        {showIngredients ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Portionen</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn-ghost btn" type="button" disabled={servings <= 1} onClick={() => setServings((s) => Math.max(1, s - 1))}>
                  −
                </button>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{servings}</span>
                <button className="btn-ghost btn" type="button" onClick={() => setServings((s) => s + 1)}>
                  +
                </button>
              </div>
            </div>
            {servings !== baseServings && (
              <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
                Original: {baseServings} Portion{baseServings === 1 ? '' : 'en'} – Mengen unten angepasst
              </p>
            )}
            <div className="entry-list" style={{ marginTop: 14 }}>
              {scaledIngredients.map((ing, i) => (
                <div className="entry-row" key={i}>
                  <div className="entry-main">
                    <div className="entry-name">{ing}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : steps.length === 0 ? (
          <p className="empty-state">Keine Zubereitungsschritte gefunden</p>
        ) : (
          <div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: 'var(--line)',
                overflow: 'hidden',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>

            <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
              Schritt {currentStep + 1} von {steps.length}
            </p>
            <div className="card" style={{ marginTop: 10, background: 'var(--bg-elevated)' }}>
              <p style={{ fontSize: 18, lineHeight: 1.6 }}>{stepText}</p>
            </div>

            {stepDuration && <StepTimer key={currentStep} initialSeconds={stepDuration} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={completed.has(currentStep)} onChange={() => toggleCompleted(currentStep)} />
              <span style={completed.has(currentStep) ? { textDecoration: 'line-through', color: 'var(--ink-muted)' } : undefined}>
                Erledigt
              </span>
            </label>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                className="btn-ghost btn"
                type="button"
                style={{ flex: 1 }}
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                ‹ Zurück
              </button>
              {currentStep < steps.length - 1 ? (
                <button className="btn" type="button" style={{ flex: 1 }} onClick={() => setCurrentStep((s) => s + 1)}>
                  Weiter ›
                </button>
              ) : (
                <button className="btn" type="button" style={{ flex: 1 }} onClick={onClose}>
                  Fertig! 🎉
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
