import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Department, EmailData, EmailStatus, Priority, User, DocumentItem, Intent, RagStats } from './types';
import { MOCK_EMAILS, MOCK_DOCUMENTS, COMPANIES, MOCK_RAG_STATS } from './constants';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import EmailDetail from './components/EmailDetail';
import { classifyEmailWithGemini } from './services/geminiService';
import { api } from './services/api';
import {
  AlertTriangle, Clock, Inbox, Search, Filter, Plus, Bot,
  Building2, Activity, RefreshCw, PieChart, TrendingUp, Shield, Lock, Terminal, Download, FileText, ChevronDown, CheckCircle2, Mail, ExternalLink, HelpCircle, Calendar,
  Settings, UserMinus, UserPlus, Save, AlertCircle, CheckCircle, Sparkles, User as UserIcon
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');

  const [emails, setEmails] = useState<EmailData[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [ragStats, setRagStats] = useState<RagStats>(MOCK_RAG_STATS);
  const [agentActive, setAgentActive] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(COMPANIES[0].id);
  const [backendStats, setBackendStats] = useState<any>(null);

  const [selectedDept, setSelectedDept] = useState<Department | 'All'>('All');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // New Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Configuration State
  const [deptHeads, setDeptHeads] = useState<Record<string, { id: string; name: string; email: string }>>({});

  const [configDept, setConfigDept] = useState<Department>(Department.SALES);
  const [newHead, setNewHead] = useState({ name: '', email: '', id: '' });
  const [configStatus, setConfigStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // --- Effects ---
  // --- Effects ---
  useEffect(() => {
    // Initial Fetch

    // Initial Fetch
    const fetchData = async () => {
      try {
        const { emails: fetchedEmails, metrics } = await api.getEmails();
        setEmails(fetchedEmails);
        setBackendStats(metrics);

        // Fetch Departments
        const depts = await api.getDepartments();
        const headsMap: Record<string, any> = {};
        depts.forEach(d => {
          headsMap[d.name] = { id: String(d.id), name: d.head_name || 'Unassigned', email: d.head_email || 'unassigned@acme.corp' };
        });
        setDeptHeads(headsMap);

      } catch (e) {
        console.error("Failed to fetch data", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Poll for updates if agent is active
    if (!user || !agentActive) return;
    const interval = setInterval(async () => {
      try {
        const { emails: fetched, metrics } = await api.getEmails();
        // Merge or replace logic - for now replace to keep sync
        setEmails(fetched);
        setBackendStats(metrics);
      } catch (e) {
        console.error("Polling failed", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, agentActive]);

  // --- Actions ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    const company = COMPANIES.find(c => c.id === selectedCompanyId)!;
    setUser({ id: `u-${Date.now()}`, name: loginEmail.split('@')[0], email: loginEmail, companyId: company.id, companyName: company.name, role: 'Admin' });
  };

  const handleSimulateIncoming = async () => {
    if (!user) return;
    const subjects = ["Access Denied: Production", "Invoice Mismatch #992", "Policy Update Request", "Critical System Failure"];
    const bodies = ["Unable to access node-7. Please investigate.", "Vendor claims $5k discrepancy.", "HR policy for remote work needs update.", "500 Errors on gateway."];
    const randomIdx = Math.floor(Math.random() * subjects.length);
    const newId = `e-${Date.now()}`;

    const placeholderEmail: EmailData = {
      id: newId, companyId: user.companyId, sender: 'alert@system.monitor', subject: subjects[randomIdx], body: bodies[randomIdx], receivedAt: new Date().toISOString(),
      department: Department.SUPPORT, priority: Priority.LOW, intent: Intent.REQUEST, confidenceScore: 0, status: EmailStatus.PROCESSING,
      history: [{ id: `h-${Date.now()}`, timestamp: new Date().toISOString(), action: 'Ingested', actor: 'System' }]
    };

    setEmails(prev => [placeholderEmail, ...prev]);
    const classification = await classifyEmailWithGemini(placeholderEmail.subject, placeholderEmail.body);
    setEmails(prev => prev.map(e => e.id === newId ? { ...e, ...classification, status: EmailStatus.NEW, history: [...e.history, { id: `h-${Date.now()}_ai`, timestamp: new Date().toISOString(), action: 'Classified', actor: 'AI Core', details: `Intent: ${classification.intent} (${classification.confidence}%)` }] } : e));
  };

  const handleSendResponse = async (emailId: string, content: string) => {
    try {
      await api.approveEmail(emailId);
      // Optimistic update
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, status: EmailStatus.SENT, suggestedResponse: content, history: [...e.history, { id: `h-${Date.now()}`, timestamp: new Date().toISOString(), action: 'Responded', actor: user?.name || 'User' }] } : e));
      setSelectedEmailId(null);
    } catch (e) {
      console.error("Failed to approve", e);
      alert("Failed to send response");
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['ID', 'Department', 'Subject', 'Priority', 'Confidence', 'Status', 'From', 'Received At'].join(','),
      ...emails.map(e => [e.id, e.department, `"${e.subject}"`, e.priority, e.confidenceScore, e.status, e.sender, e.receivedAt].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailguard-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    const sorted = [...emails].sort(() => Math.random() - 0.5);
    setEmails(sorted);
  };




  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Default to Support dept or currently selected specific dept
    const deptId = selectedDept === 'All' ? 'dept-support' : `dept-${selectedDept.toLowerCase()}`;

    try {
      await api.uploadDocument(file, deptId);
      alert("Document uploaded successfully!");
      // Optionally refresh list if we had an API for it
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigStatus(null);

    // Validation
    if (!newHead.name || !newHead.email || !newHead.id) {
      return;
    }

    const oldHead = deptHeads[configDept];
    // Optimistic Update
    setDeptHeads(prev => ({
      ...prev,
      [configDept]: { ...newHead }
    }));

    try {
      // Find ID of dept to update
      const depts = await api.getDepartments();
      const dept = depts.find(d => d.name === configDept);
      if (dept) {
        await api.updateDepartmentHead(dept.id, newHead.name, newHead.email);
        setConfigStatus({
          success: true,
          message: `Success: Updated ${configDept} head to ${newHead.name}.`
        });
      }
    } catch (e) {
      console.error("Failed to update head", e);
      // Revert on failure
      setDeptHeads(prev => ({ ...prev, [configDept]: oldHead }));
      alert("Failed to update department head.");
      setConfigStatus(null);
    }

    setNewHead({ name: '', email: '', id: '' });
  };

  // --- Renderers ---
  const renderDashboard = () => {

    const stats = {
      total: backendStats?.total || emails.length,
      pending: backendStats?.queue || emails.filter(e => e.status !== EmailStatus.SENT && e.status !== EmailStatus.AUTO_RESOLVED).length,
      autoResolved: backendStats?.sent || emails.filter(e => e.status === EmailStatus.AUTO_RESOLVED).length,
      highPriority: emails.filter(e => e.priority === Priority.HIGH && e.status !== EmailStatus.SENT).length,
      breached: emails.filter(e => e.status === EmailStatus.SLA_BREACHED).length,
    };

    return (
      <div className="space-y-6 animate-fade-in pb-10">
        {/* RAG Stats - Top Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap justify-between gap-6">
          <div title="Total documents currently indexed in the RAG system available for retrieval." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2 -ml-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><FileText className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.totalDocs}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Indexed Documents</div>
            </div>
          </div>
          <div title="Average number of documents cited per generated email response." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors"><Activity className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.avgUsage}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Citations / Email</div>
            </div>
          </div>
          <div title="Number of incoming queries where NO relevant documents were found in the Knowledge Base." className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4 cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.coverageGaps}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Missing Info Alerts</div>
            </div>
          </div>
          <div title="Overall confidence score of the AI in the accuracy of its responses based on available context." className="flex items-center gap-4 flex-1 min-w-[150px] cursor-help group transition-colors hover:bg-slate-50 rounded-lg p-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.qualityScore}%</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">AI Accuracy Score</div>
            </div>
          </div>
        </div>

        {/* Operational Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Pending Review" value={stats.pending} icon={Inbox} colorClass="text-slate-600 bg-slate-100" subtext="Requires Attention" />
          <StatCard title="Auto-Resolved" value={stats.autoResolved} icon={Bot} colorClass="text-emerald-600 bg-emerald-50" subtext="AI Handled" />
          <StatCard title="Critical Tasks" value={stats.highPriority} icon={AlertTriangle} colorClass="text-red-600 bg-red-50" subtext="High Priority" />
          <StatCard title="SLA Breaches" value={stats.breached} icon={Clock} colorClass="text-amber-600 bg-amber-50" subtext="Escalated Cases" />
        </div>

        {/* Charts & Graphs Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Trend Chart */}
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Email Volume Trend</h3>
                <p className="text-xs text-slate-500 mt-1">Incoming traffic over time</p>
              </div>
              <div className="relative">
                <select className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors">
                  <option>Weekly View</option>
                  <option>Monthly View</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="h-56 flex items-end gap-3 px-2">
              {[45, 38, 52, 41, 58, 48, 55].map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                  <div className="w-full bg-slate-50 rounded-lg relative group-hover:bg-slate-100 transition-all h-full overflow-hidden flex items-end">
                    <div className="w-full bg-blue-600 transition-all duration-500 rounded-md" style={{ height: `${val}%`, opacity: 0.85 }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600">Day {i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Load */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-6">Department Workload</h3>
            <div className="space-y-5">
              {Object.values(Department).map(dept => {
                const count = emails.filter(e => e.department === dept).length;
                const total = emails.length || 1;
                const percent = (count / total) * 100;
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                      <span>{dept}</span>
                      <span className="text-slate-900">{count} <span className="text-slate-400 font-normal">({Math.round(percent)}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-slate-800 h-2 rounded-full shadow-sm" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quality Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 text-sm mb-6">Response Quality</h3>
          <div className="flex items-center justify-center h-48 relative">
            <div className="w-32 h-32 rounded-full border-[12px] border-slate-50 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 border-[12px] border-emerald-500 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 65%, 0 65%)' }}></div>
              <div className="absolute inset-0 border-[12px] border-blue-600 rounded-full" style={{ clipPath: 'polygon(0 65%, 100% 65%, 100% 90%, 0 90%)' }}></div>
              <div className="absolute inset-0 border-[12px] border-amber-500 rounded-full" style={{ clipPath: 'polygon(0 90%, 100% 90%, 100% 100%, 0 100%)' }}></div>
              <div className="z-10 text-center bg-white w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-sm">
                <span className="text-2xl font-bold text-slate-900">94%</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> Excellent</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div> Good</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></div> Review</div>
          </div>
        </div>

        {/* Resolution Rates */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 text-sm mb-6">Resolution by Department</h3>
          <div className="space-y-4">
            {[
              { label: 'Support', val: 85, color: 'bg-blue-600' },
              { label: 'Sales', val: 78, color: 'bg-blue-600' },
              { label: 'HR', val: 92, color: 'bg-emerald-500' },
              { label: 'IT', val: 88, color: 'bg-blue-600' },
              { label: 'Legal', val: 65, color: 'bg-amber-500' },
            ].map(d => (
              <div key={d.label}>
                <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                  <span>{d.label}</span>
                  <span>{d.val}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full ${d.color}`} style={{ width: `${d.val}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 text-sm mb-6">Priority Breakdown</h3>
          <div className="flex items-end justify-between h-40 gap-4 px-4 border-b border-slate-100 pb-2">
            {[
              { label: 'High', val: 30, color: 'bg-red-500' },
              { label: 'Med', val: 45, color: 'bg-amber-500' },
              { label: 'Low', val: 25, color: 'bg-emerald-500' }
            ].map(p => (
              <div key={p.label} className="flex-1 flex flex-col items-center group">
                <div className={`w-full rounded-t-md ${p.color} bg-opacity-90 group-hover:bg-opacity-100 transition-all`} style={{ height: `${p.val * 2}%` }}></div>

              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>High</span>
            <span>Medium</span>
            <span>Low</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfiguration = () => {
    const currentHead = deptHeads[configDept];

    return (
      <div className="max-w-3xl mx-auto animate-fade-in pb-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Department Configuration</h2>
              <p className="text-xs text-slate-500 font-medium">Manage department leadership and routing protocols</p>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Select Department</label>
              <select
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={configDept}
                onChange={(e) => {
                  setConfigDept(e.target.value as Department);
                  setConfigStatus(null);
                }}
              >
                {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              {/* Current Head */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 relative group">
                <div className="absolute top-0 right-0 p-3 opacity-50">
                  <UserMinus className="w-16 h-16 text-slate-200" />
                </div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Current Head (Outgoing)</h3>
                <div className="space-y-3 relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Name</p>
                    <p className="text-sm font-bold text-slate-900">{currentHead.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Email</p>
                    <p className="text-sm font-mono text-slate-600">{currentHead.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Employee ID</p>
                    <p className="text-sm font-mono text-slate-600">{currentHead.id}</p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                    <AlertCircle className="w-3 h-3" /> Will be deactivated
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex bg-white rounded-full p-2 border border-slate-200 shadow-sm">
                <UserPlus className="w-5 h-5 text-slate-400" />
              </div>

              {/* New Head Form */}
              <div className="bg-white rounded-xl border-2 border-dashed border-blue-200 p-6">
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">New Head (Incoming)</h3>
                <form onSubmit={handleUpdateHead} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                      value={newHead.name}
                      onChange={e => setNewHead({ ...newHead, name: e.target.value })}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                      value={newHead.email}
                      onChange={e => setNewHead({ ...newHead, email: e.target.value })}
                      placeholder="john@acme.corp"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Employee ID</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400"
                      value={newHead.id}
                      onChange={e => setNewHead({ ...newHead, id: e.target.value })}
                      placeholder="e.g. EMP-999"
                    />
                  </div>

                  <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm">
                    <Save className="w-4 h-4" /> Confirm Replacement
                  </button>
                </form>
              </div>
            </div>

            {configStatus && (
              <div className={`mt-6 p-4 rounded-lg border flex items-start gap-3 animate-fade-in ${configStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {configStatus.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div className="text-sm font-medium">{configStatus.message}</div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 mb-2">Audit Log Preview</h4>
              <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                {'>'} [SYSTEM] Initiating leadership transition protocol...<br />
                {'>'} [CHECK] Department ID verified: {configDept}<br />
                {'>'} [AUTH] Admin user validated.<br />
                {'>'} [READY] Waiting for replacement confirmation...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmailList = () => {
    // Calculate counts
    const deptCounts = emails.reduce((acc, email) => {
      acc[email.department] = (acc[email.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const filtered = emails.filter(e => {
      if (selectedDept !== 'All' && e.department !== selectedDept) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const match = e.subject.toLowerCase().includes(query) ||
          e.sender.toLowerCase().includes(query) ||
          e.body.toLowerCase().includes(query);
        if (!match) return false;
      }

      if (selectedDate) {
        // Convert receivedAt (ISO) to locale date string 'YYYY-MM-DD' for comparison
        const emailDate = new Date(e.receivedAt).toLocaleDateString('en-CA');
        if (emailDate !== selectedDate) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* List Toolbar */}
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative min-w-[160px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="date"
              className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-medium"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="relative min-w-[220px]">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <select className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-8 text-sm focus:outline-none appearance-none font-medium text-slate-700" value={selectedDept} onChange={e => setSelectedDept(e.target.value as any)}>
              <option value="All">All Departments ({emails.length})</option>
              {Object.values(Department).map(d => (
                <option key={d} value={d}>{d} ({deptCounts[d] || 0})</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
          <button onClick={handleSimulateIncoming} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Simulate
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3 w-32">Department</th>
                <th className="px-6 py-3 w-28">Priority</th>
                <th className="px-6 py-3 w-24">Conf.</th>
                <th className="px-6 py-3 w-36">Status</th>
                <th className="px-6 py-3 w-40 text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(email => (
                <tr key={email.id} onClick={() => setSelectedEmailId(email.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-semibold text-slate-900 ${email.status === EmailStatus.NEW ? 'text-blue-600' : ''}`}>{email.subject}</span>
                      <span className="text-xs text-slate-500 mt-1 font-medium">{email.sender}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">{email.department}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${email.priority === Priority.HIGH ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{email.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${email.confidenceScore > 80 ? 'bg-emerald-500' : email.confidenceScore > 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                      <span className="text-slate-700 font-medium font-mono">{email.confidenceScore}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {email.status === EmailStatus.AUTO_RESOLVED ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Bot className="w-3 h-3" /> Resolved</span>
                    ) : email.status === EmailStatus.NEW ? (
                      <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> New</span>
                    ) : email.status === EmailStatus.PENDING ? (
                      <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Clock className="w-3 h-3" /> Pending</span>
                    ) : email.status === EmailStatus.NEEDS_REVIEW ? (
                      <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><AlertCircle className="w-3 h-3" /> Needs Review</span>
                    ) : email.status === EmailStatus.AI_ANSWERED ? (
                      <span className="text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><Sparkles className="w-3 h-3" /> AI Replied</span>
                    ) : email.status === EmailStatus.HUMAN_ANSWERED ? (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md flex items-center w-fit gap-1.5 text-xs font-bold"><UserIcon className="w-3 h-3" /> Human Replied</span>
                    ) : (
                      <span className="text-slate-500 text-xs font-medium">{email.status}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                    {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium">No emails found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- Main Render ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 text-white rounded-xl mb-4 shadow-lg shadow-slate-900/20">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MailGuard AI</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Enterprise Access Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Workspace</label>
              <div className="grid grid-cols-2 gap-3">
                {COMPANIES.map(c => (
                  <button type="button" key={c.id} onClick={() => setSelectedCompanyId(c.id)} className={`px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${selectedCompanyId === c.id ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-11 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 sm:text-sm transition duration-150 ease-in-out text-slate-900 font-medium shadow-sm"
                  placeholder="user@company.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
              </div>
            </div>
            <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentView={view} setView={setView} onLogout={() => setUser(null)} userRole={user.role} />

      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-baseline gap-4">
            <h1 className="text-xl font-bold text-slate-900">{view === 'dashboard' ? 'Overview' : view === 'settings' ? 'Configuration' : view.charAt(0).toUpperCase() + view.slice(1)}</h1>
            <span className="text-sm text-slate-300 font-light">|</span>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600 font-semibold">{user.companyName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors text-slate-700 shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors text-slate-700 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => setAgentActive(!agentActive)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${agentActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              <div className={`w-2 h-2 rounded-full ${agentActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`}></div>
              {agentActive ? 'AI Active' : 'AI Paused'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {view === 'dashboard' && renderDashboard()}
            {view === 'emails' && renderEmailList()}
            {view === 'analytics' && renderAnalytics()}
            {view === 'settings' && renderConfiguration()}
            {view === 'documents' && (
              <div className="space-y-6 animate-fade-in">
                {/* RAG Stats Row */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.totalDocs}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indexed Documents</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.avgUsage}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Citations / Email</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px] border-r border-slate-100 last:border-0 pr-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.coverageGaps}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missing Info Alerts</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-1 min-w-[150px]">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{ragStats.qualityScore}%</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Accuracy Score</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {documents.map(doc => (
                    <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group hover:border-blue-200">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">{doc.department}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">{doc.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono">
                        <span>{doc.id}</span>
                        <span>•</span>
                        <span>{doc.uploadDate}</span>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-500">Usage: <span className="text-slate-900">{doc.usageCount}</span></div>
                        <div className="text-xs font-bold text-emerald-600">{doc.qualityScore}% Score</div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-all min-h-[200px]"
                  >
                    <Plus className="w-8 h-8" />
                    <span className="text-sm font-bold">Upload Document</span>
                    <span className="text-xs font-semibold text-slate-400">PDF, DOCX, TXT</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.txt"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedEmailId && (
        <EmailDetail
          email={emails.find(e => e.id === selectedEmailId)!}
          documents={documents}
          onClose={() => setSelectedEmailId(null)}
          onSendResponse={handleSendResponse}
          agentActive={agentActive}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);