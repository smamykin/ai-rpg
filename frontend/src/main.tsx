import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/global.css'

registerSW({ immediate: true })

const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
orientation.lock?.('portrait').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
