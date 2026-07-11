import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Diary from './pages/Diary'
import Weight from './pages/Weight'
import Recipes from './pages/Recipes'
import RecipeGenerator from './pages/RecipeGenerator'
import FoodScan from './pages/FoodScan'
import LabelScan from './pages/LabelScan'
import Settings from './pages/Settings'
import ShoppingList from './pages/ShoppingList'
import MealTemplates from './pages/MealTemplates'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Diary />} />
              <Route path="/weight" element={<Weight />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/ki-koch" element={<RecipeGenerator />} />
              <Route path="/scan/food" element={<FoodScan />} />
              <Route path="/scan/label" element={<LabelScan />} />
              <Route path="/shopping-list" element={<ShoppingList />} />
              <Route path="/meal-templates" element={<MealTemplates />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
