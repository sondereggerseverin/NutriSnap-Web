import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const links = [
  { to: '/', label: 'Tagebuch', icon: '📔' },
  { to: '/weight', label: 'Gewicht', icon: '📈' },
  { to: '/recipes', label: 'Rezepte', icon: '📖' },
  { to: '/ki-koch', label: 'KI-Koch', icon: '✨' },
  { to: '/scan/food', label: 'Essen scannen', icon: '📷' },
  { to: '/scan/label', label: 'Etikette scannen', icon: '🏷️' },
  { to: '/shopping-list', label: 'Einkaufsliste', icon: '🛒' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Nutri<span>Snap</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <button className="sign-out-btn" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
