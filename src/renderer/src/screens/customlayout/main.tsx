import React from 'react'
import ReactDOM from 'react-dom/client'
import CustomLayout from './CustomLayout'
import '../../index.css'

// Lets CSS key off the OS, same as the launcher and settings entries.
document.documentElement.dataset.platform = window.api.platform

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CustomLayout />
  </React.StrictMode>
)
