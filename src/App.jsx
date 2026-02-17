import { createHashRouter, RouterProvider } from 'react-router-dom';
import { DataProvider } from './context/DataProvider';
import HomePage from './pages/HomePage';
import EventDetailsPage from './pages/EventDetailsPage';
import BookingPage from './pages/BookingPage';
import Layout from './components/Layout';

// Admin imports
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import EditEventPage from './pages/admin/EditEventPage';
import EditSeatsPage from './pages/admin/EditSeatsPage';
import BookingsPage from './pages/admin/BookingsPage';

const router = createHashRouter([
  {
    path: "/",
    element: <Layout><HomePage /></Layout>,
  },
  {
    path: "/event/:id",
    element: <Layout><EventDetailsPage /></Layout>,
  },
  {
    path: "/booking/:id",
    element: <Layout><BookingPage /></Layout>,
  },
  {
    path: "/admin/login",
    element: <LoginPage />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "events/:id?",
        element: <EditEventPage />,
      },
      {
        path: "seats",
        element: <EditSeatsPage />,
      },
      {
        path: "bookings",
        element: <BookingsPage />,
      },
    ],
  },
]);

function App() {
  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  );
}

export default App;
