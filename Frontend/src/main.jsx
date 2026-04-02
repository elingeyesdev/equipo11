import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SimulacionProvider } from './context/SimulacionContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SimulacionProvider>
        <App />
      </SimulacionProvider>
    </BrowserRouter>
  </StrictMode>,
)
