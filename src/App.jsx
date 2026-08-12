import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProgressDashboard from './pages/ProgressDashboard';
import DetailArea from './pages/DetailArea';
import ProcessingTime from './pages/ProcessingTime';
import Settings from './pages/Settings';
import { FilterProvider } from './contexts/FilterContext';
import { FolderSyncProvider } from './contexts/FolderSyncContext';

import { clear } from 'idb-keyval';

function App() {
  React.useEffect(() => {
    // FORCE CLEAR CACHE ONCE
    if (!localStorage.getItem('force_cleared_v8')) {
      clear().then(() => {
        localStorage.setItem('force_cleared_v8', 'true');
        window.location.reload();
      });
    }
  }, []);

  return (
    <FolderSyncProvider>
      <FilterProvider>
        <Router>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<ProgressDashboard />} />
            <Route path="detail-area" element={<DetailArea />} />
            <Route path="processing-time" element={<ProcessingTime />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
      </FilterProvider>
    </FolderSyncProvider>
  );
}

export default App;
