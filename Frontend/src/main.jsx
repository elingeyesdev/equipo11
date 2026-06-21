import '@fontsource/space-grotesk';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast/Toast'
import { PwaProvider } from './context/PwaContext'
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
        <PwaProvider>
          <RouterProvider router={router} />
        </PwaProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
