import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addRecipeToDiary } from '../lib/diary'
import {
  MealTemplate,
  addItemToTemplate,
  createTemplate,
  deleteTemplate,
  getTemplates,
  removeItemFromTemplate,
} from '../lib/mealTemplates'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../lib/types'

export default function MealTemplates() {
  const { session } = useAuth()
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [mealType, setMealType] = useState<MealType>('LUNCH')

  const [usingId, setUsingId] = useState<string | null>(null)
  const [usedId, setUsedId] = useState<string | null>(null)

  function refresh() {
    setTemplates(getTemplates())
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const t = createTemplate(name, mealType)
    setName('')
    refresh()
    setOpenTemplateId(t.id)
  }

  function handleDelete(id: string) {
    deleteTemplate(id)
    if (openTemplateId === id) setOpenTemplateId(null)
    refresh()
  }

  async function handleUse(template: MealTemplate) {
    if (!session || template.items.length === 0) return
    setUsingId(template.id)
    setUsedId(null)
    for (const item of template.items) {
      await addRecipeToDiary({
        userId: session.user.id,
        title: item.foodName,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        mealType: template.mealType,
      })
    }
    setUsingId(null)
    setUsedId(template.id)
  }

  const openTemplate = templates.find((t) => t.id === openTemplateId) ?? null

  return (
    <div>
      <div className="page-header">
        <h1>Mahlzeit-Vorlagen</h1>
        <p>Wiederkehrende Mahlzeiten als Vorlage speichern und mit einem Klick ins Tagebuch eintragen. Nur auf diesem Gerät gespeichert.</p>
      </div>

      <div className="card">
        <form className="form-row" onSubmit={handleCreate}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="mt-name">Name der Vorlage</label>
            <input id="mt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Mein Frühstück" />
          </div>
          <div className="field">
            <label htmlFor="mt-meal">Mahlzeit-Typ</label>
            <select id="mt-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {MEAL_TYPE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" disabled={!name.trim()}>
            Erstellen
          </button>
        </form>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <p className="empty-state">Noch keine Vorlagen. Erstelle oben deine erste.</p>
        </div>
      ) : (
        <div className="card">
          <div className="entry-list">
            {templates.map((t) => (
              <div className="entry-row" key={t.id}>
                <div className="entry-main" style={{ cursor: 'pointer' }} onClick={() => setOpenTemplateId(t.id)}>
                  <div className="entry-name">{t.name}</div>
                  <div className="entry-meta">
                    {MEAL_TYPE_LABELS[t.mealType]} · {t.items.length} Artikel
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {usedId === t.id && <span style={{ color: 'var(--accent)', fontSize: 12.5 }}>Eingetragen ✓</span>}
                  <button className="btn-ghost btn" type="button" disabled={t.items.length === 0 || usingId === t.id} onClick={() => handleUse(t)}>
                    {usingId === t.id ? 'Trägt ein…' : 'Verwenden'}
                  </button>
                  <button className="delete-btn" type="button" onClick={() => handleDelete(t.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openTemplate && (
        <TemplateItemsEditor
          template={openTemplate}
          onClose={() => setOpenTemplateId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

function TemplateItemsEditor({
  template,
  onClose,
  onChanged,
}: {
  template: MealTemplate
  onClose: () => void
  onChanged: () => void
}) {
  const [foodName, setFoodName] = useState('')
  const [quantityGrams, setQuantityGrams] = useState(100)
  const [calories, setCalories] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!foodName.trim()) return
    addItemToTemplate(template.id, { foodName: foodName.trim(), quantityGrams, calories, protein, carbs, fat })
    setFoodName('')
    setQuantityGrams(100)
    setCalories(0)
    setProtein(0)
    setCarbs(0)
    setFat(0)
    onChanged()
  }

  function handleRemove(itemId: string) {
    removeItemFromTemplate(template.id, itemId)
    onChanged()
  }

  return (
    <div className="scanner-overlay">
      <div className="scanner-panel" style={{ maxWidth: 480 }}>
        <div className="scanner-head">
          <span>{template.name}</span>
          <button className="scanner-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {template.items.length === 0 ? (
          <p className="empty-state">Noch keine Artikel in dieser Vorlage.</p>
        ) : (
          <div className="entry-list" style={{ marginBottom: 12 }}>
            {template.items.map((item) => (
              <div className="entry-row" key={item.id}>
                <div className="entry-main">
                  <div className="entry-name">{item.foodName}</div>
                  <div className="entry-meta">
                    {item.quantityGrams} g · {Math.round(item.calories)} kcal
                  </div>
                </div>
                <button className="delete-btn" type="button" onClick={() => handleRemove(item.id)}>
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd}>
          <div className="field">
            <label htmlFor="ti-name">Artikel</label>
            <input id="ti-name" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="z.B. Haferflocken" />
          </div>
          <div className="form-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="ti-grams">Menge (g)</label>
              <input id="ti-grams" type="number" min="0" value={quantityGrams} onChange={(e) => setQuantityGrams(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label htmlFor="ti-kcal">Kalorien</label>
              <input id="ti-kcal" type="number" min="0" value={calories} onChange={(e) => setCalories(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="ti-protein">Protein (g)</label>
              <input id="ti-protein" type="number" min="0" value={protein} onChange={(e) => setProtein(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label htmlFor="ti-carbs">Kohlenhydrate (g)</label>
              <input id="ti-carbs" type="number" min="0" value={carbs} onChange={(e) => setCarbs(Number(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label htmlFor="ti-fat">Fett (g)</label>
              <input id="ti-fat" type="number" min="0" value={fat} onChange={(e) => setFat(Number(e.target.value) || 0)} />
            </div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={!foodName.trim()}>
            Artikel hinzufügen
          </button>
        </form>
      </div>
    </div>
  )
}
