import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
  return (
    <div className="h-screen bg-[#F5F6F8] font-sans text-gray-900 flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
