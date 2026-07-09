import { FormEvent, useEffect, useState } from 'react'
import {
  ShoppingListItem,
  addShoppingItem,
  clearAllShoppingItems,
  clearCheckedShoppingItems,
  deleteShoppingItem,
  getShoppingList,
  toggleShoppingItem,
} from '../lib/shoppingList'

const MANUAL_GROUP = 'Manuell hinzugefügt'

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  function refresh() {
    setItems(getShoppingList())
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    addShoppingItem(name, amount)
    setName('')
    setAmount('')
    refresh()
  }

  function handleToggle(id: string) {
    toggleShoppingItem(id)
    refresh()
  }

  function handleDelete(id: string) {
    deleteShoppingItem(id)
    refresh()
  }

  const groups = items.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const key = item.recipeTitle ?? MANUAL_GROUP
    ;(acc[key] ??= []).push(item)
    return acc
  }, {})
  const groupNames = Object.keys(groups).sort((a, b) =>
    a === MANUAL_GROUP ? 1 : b === MANUAL_GROUP ? -1 : a.localeCompare(b)
  )
  const hasChecked = items.some((i) => i.checked)

  return (
    <div>
      <div className="page-header">
        <h1>Einkaufsliste</h1>
        <p>Nur auf diesem Gerät gespeichert (wie in der App, nicht geräteübergreifend synchronisiert).</p>
      </div>

      <div className="card">
        <form className="form-row" onSubmit={handleAdd}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="sl-name">Artikel</label>
            <input id="sl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Magerquark" />
          </div>
          <div className="field">
            <label htmlFor="sl-amount">Menge</label>
            <input id="sl-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z.B. 500 g" />
          </div>
          <button className="btn" type="submit" disabled={!name.trim()}>
            Hinzufügen
          </button>
        </form>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <p className="empty-state">Deine Einkaufsliste ist leer.</p>
        ) : (
          <>
            {groupNames.map((groupName) => (
              <div key={groupName}>
                <div className="meal-group-title">{groupName}</div>
                <div className="entry-list">
                  {groups[groupName].map((item) => (
                    <div className="entry-row" key={item.id}>
                      <div
                        className="entry-main"
                        style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        onClick={() => handleToggle(item.id)}
                      >
                        <input type="checkbox" checked={item.checked} onChange={() => handleToggle(item.id)} />
                        <div>
                          <div
                            className="entry-name"
                            style={item.checked ? { textDecoration: 'line-through', color: 'var(--ink-muted)' } : undefined}
                          >
                            {item.name}
                          </div>
                          {item.amount && <div className="entry-meta">{item.amount}</div>}
                        </div>
                      </div>
                      <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="form-row" style={{ marginTop: 20 }}>
              <button
                className="btn-ghost btn"
                type="button"
                disabled={!hasChecked}
                onClick={() => {
                  clearCheckedShoppingItems()
                  refresh()
                }}
              >
                Erledigte entfernen
              </button>
              <button
                className="btn-ghost btn"
                type="button"
                onClick={() => {
                  clearAllShoppingItems()
                  refresh()
                }}
              >
                Liste leeren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
