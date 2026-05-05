import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SimulacionProvider } from './context/SimulacionContext'
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
    <SimulacionProvider>
      <RouterProvider router={router} />
    </SimulacionProvider>
  </StrictMode>,
)
