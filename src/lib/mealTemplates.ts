import { MealType } from './types'

const TEMPLATES_KEY = 'nutrisnap_meal_templates'

export interface MealTemplateItem {
  id: string
  foodName: string
  calories: number
  protein: number
  carbs: number
  fat: number
  quantityGrams: number
}

export interface MealTemplate {
  id: string
  name: string
  mealType: MealType
  items: MealTemplateItem[]
  createdAt: number
}

function read(): MealTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    return raw ? (JSON.parse(raw) as MealTemplate[]) : []
  } catch {
    return []
  }
}

function write(templates: MealTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function getTemplates(): MealTemplate[] {
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

export function createTemplate(name: string, mealType: MealType): MealTemplate {
  const templates = read()
  const template: MealTemplate = { id: crypto.randomUUID(), name: name.trim(), mealType, items: [], createdAt: Date.now() }
  templates.push(template)
  write(templates)
  return template
}

export function deleteTemplate(id: string) {
  write(read().filter((t) => t.id !== id))
}

export function addItemToTemplate(templateId: string, item: Omit<MealTemplateItem, 'id'>) {
  const templates = read()
  const template = templates.find((t) => t.id === templateId)
  if (!template) return
  template.items.push({ ...item, id: crypto.randomUUID() })
  write(templates)
}

export function removeItemFromTemplate(templateId: string, itemId: string) {
  const templates = read()
  const template = templates.find((t) => t.id === templateId)
  if (!template) return
  template.items = template.items.filter((i) => i.id !== itemId)
  write(templates)
}
