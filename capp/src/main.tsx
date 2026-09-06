import React from 'react'
import { Buffer } from 'buffer'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// @solana/web3.js@1.x still touches the Node-style Buffer global in a few
// browser code paths — provide the `buffer` npm package implementation.
if (typeof window !== 'undefined') {
  ;(window as unknown as { Buffer?: unknown }).Buffer ??= Buffer
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
