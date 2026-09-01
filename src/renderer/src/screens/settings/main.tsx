import React from 'react'
import ReactDOM from 'react-dom/client'
import Settings from './Settings'
import '../../index.css'

// Lets CSS key off the OS, same as the launcher entry.
document.documentElement.dataset.platform = window.api.platform

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>
)
