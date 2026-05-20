import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SimulacionProvider } from './context/SimulacionContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast/Toast'
import './index.css'
import App from './App.jsx'

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
  }
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SimulacionProvider>
          <RouterProvider router={router} />
        </SimulacionProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
