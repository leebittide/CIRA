import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, query, doc, updateDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../ui/toast-container';
import { SettingsPage } from '../settings/SettingsPage';
import { UserManagement } from './UserManagement';
import { Button } from '../ui/button';
import { Ticket, Clock, CheckCircle, AlertCircle, FileText, ClipboardList, Trash2, XCircle, Settings as SettingsIcon, PlayCircle, Users, Check, X, Pencil, Edit } from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  name: string;
  type: 'text' | 'select' | 'textarea';
  order: number;
}

interface TicketType {
  id: string;
  status: 'submitted' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'rejected';
  userId: string;
  rejectionNote?: string;
  resolutionNote?: string;
  requestedAt?: { toDate: () => Date };
  [key: string]: any; // Allow dynamic properties
}

interface AdminDashboardProps {
  logoClickTime: number;
  profileClickTime: number;
}
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ logoClickTime, profileClickTime }) => {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [activeTab, setActiveTab] = useState<'tickets' | 'settings' | 'user-management'>('tickets');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [rejectionNote, setRejectionNote] = useState<{ [key: string]: string }>({});
  const [resolutionNote, setResolutionNote] = useState<{ [key: string]: string }>({});
  const [showRejectionNote, setShowRejectionNote] = useState<{ [key: string]: boolean }>({});
  const [showResolutionNote, setShowResolutionNote] = useState<{ [key: string]: boolean }>({});

  const { showToast } = useToast();

  useEffect(() => {
    if (logoClickTime > 0) {
      setActiveTab('tickets');
      setReviewFilter('all');
    }
  }, [logoClickTime]);

  useEffect(() => {
    if (profileClickTime > 0) {
      setActiveTab('settings');
    }
  }, [profileClickTime]);

  useEffect(() => {
    const q = query(collection(db, 'tickets'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketType));
      const filteredTickets = ticketsData.filter(ticket => ticket.status !== 'submitted');
      setTickets(filteredTickets);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const formFieldsCollection = query(collection(db, 'form-structure'), orderBy('order'));
    const unsubscribe = onSnapshot(formFieldsCollection, (snapshot) => {
      const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField));
      const uniqueFields = fields.filter((field, index, self) => 
        index === self.findIndex(f => f.name === field.name)
      );
      setFormFields(uniqueFields);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (ticketId: string, status: TicketType['status'], note?: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      const updateData: { status: TicketType['status']; resolutionNote?: string; requestedAt?: any } = { status };

      if (status === 'requested') {
        updateData.requestedAt = new Date();
      }

      if (status === 'pending-resolution' && note) {
        updateData.resolutionNote = note;
      }
      
      await updateDoc(ticketRef, updateData);
      showToast(`Ticket status updated to ${status}`, 'success');
      if (status === 'pending-resolution') {
        setResolutionNote(prev => {
          const updated = { ...prev };
          delete updated[ticketId];
          return updated;
        });
        setShowResolutionNote(prev => ({ ...prev, [ticketId]: false }));
      }
    } catch (error) {
      showToast('Failed to update ticket status', 'error');
    }
  };

  const handleResolveWithNote = async (ticketId: string) => {
    const note = resolutionNote[ticketId];
    if (!note || note.trim() === '') {
      showToast('Please provide a resolution note for the ticket.', 'error');
      return;
    }
    await handleStatusUpdate(ticketId, 'pending-resolution', note);
  };

  const getUniqueValues = (field: keyof TicketType) => {
    if (field === 'requestedAt') {
        return [
            ...new Set(
                tickets
                    .map(ticket => ticket.requestedAt ? ticket.requestedAt.toDate().toLocaleDateString() : null)
                    .filter(date => date !== null) as string[]
            ),
        ];
    }
    return [...new Set(tickets.map(ticket => ticket[field]))];
  };

  const filteredTickets = tickets
    .filter(t => reviewFilter === 'all' || t.status === reviewFilter)
    .filter(ticket => {
        if (searchField === 'all' || !searchValue) return true;
        const fieldValue = ticket[searchField as keyof TicketType];
        if (searchField === 'requestedAt' && fieldValue instanceof Date) {
            return fieldValue.toLocaleDateString() === searchValue;
        }
        return String(fieldValue).toLowerCase() === searchValue.toLowerCase();
    });

  const requestedTickets = tickets.filter(t => t.status === 'requested');
  const inProgressTickets = tickets.filter(t => t.status === 'in-progress');
  const pendingResolutionTickets = tickets.filter(t => t.status === 'pending-resolution');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const stats = [
    { label: 'Requested', count: requestedTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'requested' as const },
    { label: 'In Progress', count: inProgressTickets.length, icon: AlertCircle, color: 'bg-[#3942A7]', status: 'in-progress' as const },
    { label: 'Pending Resolution', count: pendingResolutionTickets.length, icon: Clock, color: 'bg-[#FFC107]', status: 'pending-resolution' as const },
    { label: 'Resolved', count: resolvedTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'resolved' as const },
  ];

  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: ClipboardList },
    { id: 'user-management', label: 'User Management', icon: Users },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-[#1E1E1E] mb-2">Admin Dashboard</h1>
          <p className="text-[#7A7A7A]">Manage tickets, users, and forms</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: index * 0.1 }} 
            onClick={() => { setActiveTab('tickets'); setReviewFilter(stat.status); }}
            onMouseEnter={() => setHoveredStat(stat.status)}
            onMouseLeave={() => setHoveredStat(null)}
            style={{
              backgroundColor: hoveredStat === stat.status ? '#3942A7' : 'white',
              color: hoveredStat === stat.status ? 'white' : '#1E1E1E',
              border: '1px solid #D1D5DB'
            }}
            className="rounded-xl shadow-md p-6 cursor-pointer transition-colors">
            <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center mb-3`}><stat.icon className="w-6 h-6 text-white" /></div>
            <p className="text-[#7A7A7A] mb-1" style={{color: hoveredStat === stat.status ? 'white' : '#7A7A7A'}}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{color: hoveredStat === stat.status ? 'white' : '#1E1E1E'}}>{stat.count}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                backgroundColor: activeTab === tab.id ? '#3942A7' : (hoveredTab === tab.id ? '#4d57c8' : 'white'),
                color: activeTab === tab.id || hoveredTab === tab.id ? 'white' : '#7A7A7A'
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 transition-all whitespace-nowrap cursor-pointer`}>
              <tab.icon className="w-5 h-5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'tickets' && (
          <motion.div key="tickets" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button 
                  onClick={() => setReviewFilter('all')} 
                  style={{backgroundColor: reviewFilter === 'all' ? '#1B1F50' : 'white', color: reviewFilter === 'all' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  All ({tickets.length})
                </button>
                <button 
                  onClick={() => setReviewFilter('requested')} 
                  style={{backgroundColor: reviewFilter === 'requested' ? '#1DB954' : 'white', color: reviewFilter === 'requested' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Requested ({requestedTickets.length})
                </button>
                <button 
                  onClick={() => setReviewFilter('in-progress')} 
                  style={{backgroundColor: reviewFilter === 'in-progress' ? '#3942A7' : 'white', color: reviewFilter === 'in-progress' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  In Progress ({inProgressTickets.length})
                </button>
                <button 
                  onClick={() => setReviewFilter('pending-resolution')} 
                  style={{backgroundColor: reviewFilter === 'pending-resolution' ? '#FFC107' : 'white', color: reviewFilter === 'pending-resolution' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Pending Resolution ({pendingResolutionTickets.length})
                </button>
                <button 
                  onClick={() => setReviewFilter('resolved')} 
                  style={{backgroundColor: reviewFilter === 'resolved' ? '#1DB954' : 'white', color: reviewFilter === 'resolved' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Resolved ({resolvedTickets.length})
                </button>
              </div>
            </div>

            <div className="mb-6 flex gap-4">
                <select value={searchField} onChange={(e) => {setSearchField(e.target.value); setSearchValue('');}} className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3942A7] transition-all">
                    <option value="all">All Fields</option>
                    {formFields.map(field => (
                        <option key={field.id} value={field.name}>{field.label}</option>
                    ))}
                    <option value="requestedAt">Date Requested</option>
                    <option value="status">Status</option>
                </select>
                {searchField !== 'all' && (
                    <select value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3942A7] transition-all">
                        <option value="">Select a value</option>
                        {getUniqueValues(searchField as keyof TicketType).map(value => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                )}
            </div>

            {filteredTickets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center"><FileText className="w-16 h-16 mx-auto text-[#7A7A7A] mb-4" /><h3 className="text-[#1E1E1E] mb-2">No tickets found</h3><p className="text-[#7A7A7A]">{searchQuery ? 'Try adjusting your search query' : `There are no ${reviewFilter} tickets`}</p></div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-white uppercase" style={{backgroundColor: '#3942A7'}}>
                    <tr>
                      {formFields.map(field => (
                        <th key={field.id} scope="col" className="px-6 py-3"><div className="flex items-center justify-center">{field.label}</div></th>
                      ))}
                      <th scope="col" className="px-6 py-3"><div className="flex items-center justify-center">Date Requested</div></th>
                      <th scope="col" className="px-6 py-3"><div className="flex items-center justify-center">Status</div></th>
                      <th scope="col" className="px-6 py-3"><div className="flex items-center justify-center">Actions</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket, index) => (
                      <tr key={ticket.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {formFields.map(field => (
                            <td key={field.id} className="px-6 py-4"><div className="flex items-center justify-center">{ticket[field.name] || 'N/A'}</div></td>
                        ))}
                        <td className="px-6 py-4"><div className="flex items-center justify-center">{ticket.requestedAt ? ticket.requestedAt.toDate().toLocaleDateString() : 'N/A'}</div></td>
                        <td className="px-6 py-4">
                            <div className="flex items-center justify-center">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${
                                    ticket.status === 'requested' ? 'bg-[#1DB954]' :
                                    ticket.status === 'in-progress' ? 'bg-[#3942A7]' :
                                    ticket.status === 'pending-resolution' ? 'bg-[#FFC107]' :
                                    ticket.status === 'resolved' ? 'bg-[#1DB954]' :
                                    'bg-[#FF4D4F]'
                                }`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-2">
                            {ticket.status === 'requested' && <Button onClick={() => handleStatusUpdate(ticket.id, 'in-progress')} variant="default"><PlayCircle className="w-4 h-4 mr-2"/>Start Progress</Button>}
                            {ticket.status === 'in-progress' && (
                              <>
                                {!showResolutionNote[ticket.id] ? (
                                  <Button onClick={() => setShowResolutionNote(prev => ({ ...prev, [ticket.id]: true }))} variant="secondary"><Pencil className="w-4 h-4 mr-2"/>Resolve</Button>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <textarea value={resolutionNote[ticket.id] || ''} onChange={(e) => setResolutionNote(prev => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Resolution Note..." className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#3942A7]" />
                                    <div className="flex gap-2">
                                      <Button onClick={() => handleResolveWithNote(ticket.id)} variant="secondary" className="flex-1">Confirm</Button>
                                      <Button onClick={() => setShowResolutionNote(prev => ({ ...prev, [ticket.id]: false }))} variant="ghost" className="flex-1">Cancel</Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'user-management' && (
          <motion.div key="user-management" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <UserManagement />
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <SettingsPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
