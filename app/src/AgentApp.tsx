import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { MarketsHome } from './pages/MarketsHome';
import { MarketAgentPage } from './pages/MarketAgentPage';
import './agent.css';

const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { index: true, element: <MarketsHome /> },
        { path: 'market/:marketId', element: <MarketAgentPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: false,
    },
  },
);

export default function AgentApp() {
  return <RouterProvider router={router} />;
}
