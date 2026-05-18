import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// TychePrime x FunctionSPACE: browse open markets, then run a per-market forecaster.
import App from './AgentApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
