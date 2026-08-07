import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProgressDashboard from './pages/ProgressDashboard';
import DetailArea from './pages/DetailArea';
import ProcessingTime from './pages/ProcessingTime';
import Settings from './pages/Settings';
import { FilterProvider } from './contexts/FilterContext';
import { FolderSyncProvider } from './contexts/FolderSyncContext';

function App() {
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
