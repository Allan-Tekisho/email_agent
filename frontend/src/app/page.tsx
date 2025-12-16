"use client";
import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle, FileText, Settings, Upload } from 'lucide-react';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [emails, setEmails] = useState([]);
    const [metrics, setMetrics] = useState({ total: 0, queue: 0, sent: 0, avgConfidence: 0 });
    const [departments, setDepartments] = useState([]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadDept, setUploadDept] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');

    const fetchEmails = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/emails');
            const data = await res.json();
            setEmails(data.emails);
            setMetrics(data.metrics);
        } catch (e) { console.error(e); }
    };

    const fetchDepts = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/departments');
            setDepartments(await res.json());
        } catch (e) { console.error(e); }
    }

    useEffect(() => {
        fetchEmails();
        fetchDepts();
        const interval = setInterval(fetchEmails, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        await fetch(`http://localhost:4000/api/emails/${id}/${action}`, { method: 'POST' });
        fetchEmails();
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('dept_id', uploadDept);

        setUploadStatus("Uploading & Indexing...");
        try {
            const res = await fetch('http://localhost:4000/api/documents', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            setUploadStatus(`Success! Indexed ${data.chunks} chunks.`);
            setUploadFile(null);
        } catch (e) {
            setUploadStatus("Error uploading.");
        }
    };

    const updateHead = async (id: number, head_name: string, head_email: string) => {
        await fetch(`http://localhost:4000/api/departments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ head_name, head_email })
        });
        fetchDepts();
        alert("Updated!");
    }

    return (
        <div className="dashboard-grid">
            <aside className="sidebar">
                <h1 className="text-xl font-bold mb-8 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-blue-600" />
                    Email Agent
                </h1>
                <nav className="space-y-2">
                    <div onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-lg font-medium cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Dashboard</div>
                    <div onClick={() => setActiveTab('kb')} className={`p-3 rounded-lg font-medium cursor-pointer ${activeTab === 'kb' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Knowledge Base</div>
                    <div onClick={() => setActiveTab('settings')} className={`p-3 rounded-lg font-medium cursor-pointer ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Settings</div>
                </nav>
            </aside>

            <main className="main-content">
                {activeTab === 'dashboard' && (
                    <>
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <MetricCard title="Total Emails" value={metrics?.total || 0} icon={<Mail />} />
                            <MetricCard title="In Queue" value={metrics?.queue || 0} icon={<Clock />} color="text-amber-600" />
                            <MetricCard title="Auto Sent" value={metrics?.sent || 0} icon={<CheckCircle />} color="text-green-600" />
                            <MetricCard title="Avg Confidence" value={metrics?.avgConfidence ? `${(metrics.avgConfidence * 100).toFixed(0)}%` : '0%'} icon={<AlertCircle />} />
                        </div>

                        <div className="card">
                            <h2 className="text-lg font-semibold mb-4">Review Queue</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-gray-500 text-sm">
                                            <th className="pb-3">Subject</th>
                                            <th className="pb-3">Dept</th>
                                            <th className="pb-3">Confidence</th>
                                            <th className="pb-3">Suggested Reply</th>
                                            <th className="pb-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(emails || []).map((email: any) => (
                                            <tr key={email.id} className="group hover:bg-gray-50">
                                                <td className="py-4 pr-4 font-medium">{email.subject}</td>
                                                <td className="py-4">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                                                        {email.dept_name}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-sm">{(email.confidence * 100).toFixed(0)}%</td>
                                                <td className="py-4 text-sm text-gray-500 max-w-md truncate">
                                                    {email.generated_reply || 'Generating...'}
                                                </td>
                                                <td className="py-4 text-right space-x-2">
                                                    <button onClick={() => handleAction(email.id, 'approve')}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                                                        Send
                                                    </button>
                                                    <button onClick={() => handleAction(email.id, 'reject')}
                                                        className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                                                        Skip
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'kb' && (
                    <div className="max-w-xl mx-auto card">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Upload className="w-5 h-5" /> Upload Documents (PDF/Text)
                        </h2>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <select className="w-full p-2 border rounded-md"
                                    onChange={e => setUploadDept(e.target.value)} required>
                                    <option value="">Select Department</option>
                                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Document</label>
                                <input type="file" className="w-full" onChange={(e: any) => setUploadFile(e.target.files[0])} accept=".pdf,.txt,.docx" required />
                            </div>
                            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                                Upload & Index
                            </button>
                        </form>
                        {uploadStatus && <div className="mt-4 p-3 bg-gray-50 text-center rounded-md font-medium text-sm text-gray-700">{uploadStatus}</div>}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="card">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Settings className="w-5 h-5" /> Department Heads
                        </h2>
                        <div className="space-y-4">
                            {departments.map((dept: any) => (
                                <div key={dept.id} className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50 items-end">
                                    <div className="font-medium text-gray-700 py-2">{dept.name}</div>
                                    <div>
                                        <label className="text-xs text-gray-500">Name</label>
                                        <input type="text" defaultValue={dept.head_name}
                                            onBlur={(e) => updateHead(dept.id, e.target.value, dept.head_email)}
                                            className="w-full text-sm p-2 border rounded" placeholder="Head Name" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Email (CC)</label>
                                        <input type="email" defaultValue={dept.head_email}
                                            onBlur={(e) => updateHead(dept.id, dept.head_name, e.target.value)}
                                            className="w-full text-sm p-2 border rounded" placeholder="email@company.com" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function MetricCard({ title, value, icon, color = 'text-gray-600' }: any) {
    return (
        <div className="card flex items-center gap-4">
            <div className={`p-3 rounded-full bg-gray-50 ${color}`}>{icon}</div>
            <div>
                <div className="text-sm text-gray-500">{title}</div>
                <div className="text-2xl font-bold">{value}</div>
            </div>
        </div>
    )
}
