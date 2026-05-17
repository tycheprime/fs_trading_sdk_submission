import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// BTC market-maker agent: an autonomous agent that searches exa.ai, has Claude
// interpret the results, and re-positions itself on FunctionSpace market #242.
import App from './AgentApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
