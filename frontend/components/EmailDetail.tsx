import React, { useState, useEffect } from 'react';
import { EmailData, DocumentItem, EmailStatus, Priority } from '../types';
import { draftResponseWithGemini } from '../services/geminiService';
import { X, Sparkles, Send, Clock, FileText, AlertTriangle, UserCheck, ShieldAlert, Cpu, Database, ChevronRight, ThumbsUp, ThumbsDown, BookOpen, ExternalLink, CheckCircle2, Timer } from 'lucide-react';

interface EmailDetailProps {
   email: EmailData;
   documents: DocumentItem[];
   onClose: () => void;
   onSendResponse: (emailId: string, content: string) => void;
   agentActive: boolean;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ email, documents, onClose, onSendResponse, agentActive }) => {
   const [draft, setDraft] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [activeTab, setActiveTab] = useState<'response' | 'history'>('response');
   const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
   const [autoSendTimer, setAutoSendTimer] = useState<number | null>(null);

   useEffect(() => {
      if (!email) return;

      if (agentActive && !email.suggestedResponse && email.status !== EmailStatus.SENT && email.status !== EmailStatus.AUTO_RESOLVED) {
         handleGenerateDraft();
      } else {
         setDraft(email.suggestedResponse || '');
      }
   }, [email, agentActive]);

   if (!email) return null;

   useEffect(() => {
      if (autoSendTimer === null) return;

      if (autoSendTimer > 0) {
         const timer = setTimeout(() => {
            setAutoSendTimer(prev => (prev !== null ? prev - 1 : null));
         }, 1000);
         return () => clearTimeout(timer);
      } else if (autoSendTimer === 0) {
         // Timer finished, send response
         onSendResponse(email.id, draft);
         setAutoSendTimer(null);
      }
   }, [autoSendTimer, draft, email.id, onSendResponse]);

   const handleGenerateDraft = async () => {
      setIsGenerating(true);
      const response = await draftResponseWithGemini(email, documents);
      setDraft(response);
      setIsGenerating(false);

      // Start auto-send countdown (3 seconds)
      if (agentActive) {
         setAutoSendTimer(3);
      }
   };

   const handleFeedback = (type: 'positive' | 'negative') => {
      setFeedback(type);
   };

   const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      // Cancel auto-send if user edits the draft
      if (autoSendTimer !== null) {
         setAutoSendTimer(null);
      }
   };

   const cancelAutoSend = () => {
      setAutoSendTimer(null);
   };

   return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-6">
         <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex overflow-hidden animate-fade-in relative ring-1 ring-white/10">

            {/* Left Column: Context & Metadata */}
            <div className="w-[380px] border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
               <div className="p-6 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-4">
                     <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${email.priority === Priority.HIGH ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        {email.priority} Priority
                     </div>
                     <span className="text-xs text-slate-400 font-mono font-medium">{email.id}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug mb-4">{email.subject}</h2>
                  <div className="flex items-center gap-3">
                     <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                        {email.sender.substring(0, 2).toUpperCase()}
                     </div>
                     <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-900 truncate">{email.sender}</p>
                        <p className="text-xs text-slate-500 truncate font-medium">Via Outlook Integration</p>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Message Body</label>
                     <div className="text-sm text-slate-700 leading-relaxed bg-white p-5 rounded-xl border border-slate-200 shadow-sm whitespace-pre-wrap">
                        {email.body}
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">AI Classification</label>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                           <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Department</span>
                           <span className="text-sm font-bold text-slate-900">{email.department}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                           <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Intent</span>
                           <span className="text-sm font-bold text-slate-900">{email.intent}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2 shadow-sm">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] text-slate-400 uppercase font-bold">Confidence Score</span>
                              <span className={`text-xs font-bold ${email.confidenceScore > 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{email.confidenceScore}%</span>
                           </div>
                           <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-2 rounded-full ${email.confidenceScore > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${email.confidenceScore}%` }}></div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Citations Section */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5" /> Knowledge Sources
                     </label>
                     <div className="space-y-2">
                        {email.citations && email.citations.length > 0 ? email.citations.map((cite, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-start group hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                              <div>
                                 <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 flex items-center gap-1.5 transition-colors">
                                    {cite.source} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                 </div>
                                 <div className="text-[10px] text-slate-500 mt-0.5 font-medium">Relevance Score: High</div>
                              </div>
                              <div className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                 {cite.usageCount}x
                              </div>
                           </div>
                        )) : (
                           <div className="text-xs text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-lg">No direct knowledge base citations found.</div>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            {/* Right Column: Action Center */}
            <div className="flex-1 flex flex-col bg-white">
               {/* Header */}
               <div className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white">
                  <div className="flex gap-8 h-full">
                     <button onClick={() => setActiveTab('response')} className={`h-full flex items-center gap-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'response' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                        <Sparkles className="w-4 h-4" /> AI Draft
                     </button>
                     <button onClick={() => setActiveTab('history')} className={`h-full flex items-center gap-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                        <Database className="w-4 h-4" /> Activity Log
                     </button>
                  </div>
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               {/* Content */}
               <div className="flex-1 overflow-hidden flex flex-col p-8 bg-slate-50/50">
                  {activeTab === 'response' ? (
                     <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                           <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Status:</span>
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${email.confidenceScore > 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                 {email.confidenceScore > 80 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                 {email.confidenceScore > 80 ? 'Ready for Approval' : 'Review Suggested'}
                              </span>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-slate-400">Helpful?</span>
                              <div className="flex bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                                 <button onClick={() => handleFeedback('positive')} className={`p-1.5 rounded-md transition-colors ${feedback === 'positive' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-emerald-600'}`}><ThumbsUp className="w-4 h-4" /></button>
                                 <button onClick={() => handleFeedback('negative')} className={`p-1.5 rounded-md transition-colors ${feedback === 'negative' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-red-600'}`}><ThumbsDown className="w-4 h-4" /></button>
                              </div>
                              <div className="w-px h-5 bg-slate-200 mx-1"></div>
                              <button onClick={handleGenerateDraft} disabled={isGenerating} className="text-xs font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors border border-slate-200 bg-white">
                                 Regenerate
                              </button>
                           </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 relative">
                           {isGenerating && (
                              <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center backdrop-blur-[1px]">
                                 <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                 <span className="text-sm font-bold text-slate-900">Generating Response...</span>
                                 <span className="text-xs text-slate-500 font-medium mt-1">Consulting Knowledge Base</span>
                              </div>
                           )}
                           <textarea
                              value={draft}
                              onChange={handleDraftChange}
                              className="w-full h-full p-8 resize-none outline-none text-slate-900 text-sm leading-8 font-mono placeholder-slate-300 bg-white"
                              spellCheck={false}
                              placeholder="Draft content will appear here..."
                           />
                        </div>
                     </div>
                  ) : (
                     <div className="flex-1 overflow-y-auto space-y-0 pr-2">
                        {email.history.map((event, idx) => (
                           <div key={idx} className="flex gap-4 pb-8 last:pb-0 relative group">
                              {idx !== email.history.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 group-hover:bg-slate-300 transition-colors"></div>}
                              <div className="relative z-10 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                                 <div className="w-2.5 h-2.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors"></div>
                              </div>
                              <div className="flex-1 pt-1">
                                 <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-900">{event.action}</span>
                                    <span className="text-xs text-slate-400 font-mono font-medium">{new Date(event.timestamp).toLocaleString()}</span>
                                 </div>
                                 <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-semibold text-slate-500">Actor:</span>
                                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold">{event.actor}</span>
                                 </div>
                                 {event.details && <p className="text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm leading-relaxed">{event.details}</p>}
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>

               {/* Footer */}
               <div className="h-20 border-t border-slate-200 flex justify-between items-center px-8 bg-white shrink-0">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CC Recipient(s)</span>
                     <span className="text-sm font-medium text-slate-700">{email.cc?.join(', ') || 'None'}</span>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={onClose} className="px-6 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors uppercase tracking-wide">
                        Discard
                     </button>

                     {autoSendTimer !== null ? (
                        <button
                           onClick={cancelAutoSend}
                           className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-emerald-900/10 flex items-center gap-2 transition-all uppercase tracking-wide transform active:scale-95 animate-pulse"
                        >
                           <Timer className="w-3.5 h-3.5 spin-slow" /> Sending in {autoSendTimer}s... (Cancel)
                        </button>
                     ) : (
                        <button
                           onClick={() => onSendResponse(email.id, draft)}
                           disabled={!draft || email.status === EmailStatus.SENT || email.status === EmailStatus.AUTO_RESOLVED}
                           className="bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 flex items-center gap-2 transition-all uppercase tracking-wide transform active:scale-95"
                        >
                           <Send className="w-3.5 h-3.5" /> {email.status === EmailStatus.SENT ? 'Sent' : 'Approve & Send'}
                        </button>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default EmailDetail;