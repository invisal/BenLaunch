import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Lets CSS key off the OS (e.g. a more translucent background on macOS, where
// the window sits on an electron-liquid-glass surface).
document.documentElement.dataset.platform = window.api.platform

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
