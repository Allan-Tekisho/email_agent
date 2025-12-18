import React from 'react';
import { LayoutDashboard, Mail, FileText, Settings, LogOut, ShieldCheck, BarChart3 } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  userRole: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout, userRole }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Intelligence', icon: BarChart3 },
    { id: 'emails', label: 'Communications', icon: Mail },
    { id: 'documents', label: 'Knowledge Base', icon: FileText },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col fixed left-0 top-0 z-30 shadow-xl text-white">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-900/50">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-none">MailGuard AI</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Enterprise</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1 space-y-8 overflow-y-auto">
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Operations</p>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  currentView === item.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className={`w-4 h-4 transition-colors ${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">System</p>
          <button
              onClick={() => setView('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all`}
            >
              <Settings className="w-4 h-4 text-slate-500 group-hover:text-white" />
              Configuration
          </button>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
            {userRole.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-slate-200 truncate">Operator ID: 8492</p>
            <p className="text-[10px] text-blue-400 truncate uppercase font-semibold">{userRole}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;