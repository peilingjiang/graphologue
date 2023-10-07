import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { createBrowserHistory, createHashHistory } from 'history'

import { ChatApp } from './App'

// ! the only css imports in ts/x files
import './css/index.scss'
import 'reactflow/dist/style.css'
import { isElectron } from './electron'

if (process.env.NODE_ENV === 'production') {
  console.log = () => {}
  console.error = () => {}
  console.debug = () => {}
}

export const history = isElectron()
  ? createHashHistory()
  : createBrowserHistory()

/* -------------------------------------------------------------------------- */

// ! set up react router
const router = createBrowserRouter([
  {
    path: '/*',
    element: <ChatApp />,
  },
])

// ! render app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
