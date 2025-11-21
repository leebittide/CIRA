import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Clock, CheckCircle, AlertCircle, FileText, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { TicketForm } from '../tickets/TicketForm';
import { SettingsPage } from '../settings/SettingsPage';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast-container';

interface FormField {
  id: string;
  label: string;
  name: string;
  type: 'text' | 'select' | 'textarea';
  order: number;
}

interface TicketType {
  id: string;
  status: 'submitted' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'rejected' | 'pending-confirmation';
  userId: string;
  rejectionNote?: string;
  resolutionNote?: string;
  requestedAt?: { toDate: () => Date };
  [key: string]: any; // Allow dynamic properties
}

interface StudentDashboardProps {
  logoClickTime: number;
  profileClickTime: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ logoClickTime, profileClickTime }) => {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [activeTab, setActiveTab] = useState<'tickets' | 'report' | 'settings'>('tickets');
  const [filter, setFilter] = useState<'all' | 'submitted' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'pending-confirmation'>('all');
  const [searchField, setSearchField] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    if (logoClickTime > 0) {
      setActiveTab('tickets');
      setFilter('all');
    }
  }, [logoClickTime]);

  useEffect(() => {
    if (profileClickTime > 0) {
      setActiveTab('settings');
    }
  }, [profileClickTime]);


  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, 'tickets'), where('userId', '==', auth.currentUser.uid));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const ticketsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as TicketType[];
        setTickets(ticketsData);
      });

      return () => unsubscribe();
    }
  }, [auth.currentUser]);

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

  const handleConfirmResolution = async (ticketId: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, { status: 'pending-confirmation' });
      showToast('Resolution confirmed and sent to Class Rep for final review', 'success');
    } catch (error) {
      showToast('Failed to confirm ticket resolution', 'error');
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (confirm('Are you sure you want to delete this ticket?')) {
      try {
        await deleteDoc(doc(db, 'tickets', ticketId));
        showToast('Ticket deleted successfully', 'success');
      } catch (error) {
        showToast('Failed to delete ticket', 'error');
      }
    }
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
    .filter(t => {
        if (filter === 'all') return true;
        if (filter === 'pending-resolution') {
            return t.status === 'pending-resolution' || t.status === 'pending-confirmation';
        }
        return t.status === filter;
    })
    .filter(ticket => {
        if (searchField === 'all' || !searchValue) return true;
        const fieldValue = ticket[searchField as keyof TicketType];
        if (searchField === 'requestedAt' && ticket.requestedAt) {
             return ticket.requestedAt.toDate().toLocaleDateString() === searchValue;
        }
        return String(fieldValue).toLowerCase() === searchValue.toLowerCase();
    });
  
  const submittedTickets = tickets.filter(t => t.status === 'submitted');
  const requestedTickets = tickets.filter(t => t.status === 'requested');
  const inProgressTickets = tickets.filter(t => t.status === 'in-progress');
  const pendingResolutionTickets = tickets.filter(t => t.status === 'pending-resolution' || t.status === 'pending-confirmation');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const stats = [
    { label: 'Submitted', count: submittedTickets.length, icon: Clock, color: 'bg-[#FFC107]', status: 'submitted' as const },
    { label: 'Requested', count: requestedTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'requested' as const },
    { label: 'In Progress', count: inProgressTickets.length, icon: AlertCircle, color: 'bg-[#3942A7]', status: 'in-progress' as const },
    { label: 'Pending Resolution', count: pendingResolutionTickets.length, icon: Clock, color: 'bg-[#FFC107]', status: 'pending-resolution' as const },
    { label: 'Resolved', count: resolvedTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'resolved' as const },
  ];

  const tabs = [
    { id: 'tickets', label: 'My Tickets', icon: Ticket },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-[#1E1E1E] mb-2">Student Dashboard</h1>
        <p className="text-[#7A7A7A]">Here you can view your submitted tickets and report new issues.</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, index) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: index * 0.1 }} 
            onClick={() => { setActiveTab('tickets'); setFilter(stat.status); }}
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
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button onClick={() => setFilter('all')} style={{backgroundColor: filter === 'all' ? '#1B1F50' : 'white', color: filter === 'all' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>All ({tickets.length})</button>
                <button onClick={() => setFilter('submitted')} style={{backgroundColor: filter === 'submitted' ? '#FFC107' : 'white', color: filter === 'submitted' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>Submitted ({submittedTickets.length})</button>
                <button onClick={() => setFilter('requested')} style={{backgroundColor: filter === 'requested' ? '#1DB954' : 'white', color: filter === 'requested' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>Requested ({requestedTickets.length})</button>
                <button onClick={() => setFilter('in-progress')} style={{backgroundColor: filter === 'in-progress' ? '#3942A7' : 'white', color: filter === 'in-progress' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>In Progress ({inProgressTickets.length})</button>
                <button onClick={() => setFilter('pending-resolution')} style={{backgroundColor: filter === 'pending-resolution' ? '#FFC107' : 'white', color: filter === 'pending-resolution' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>Pending Resolution ({pendingResolutionTickets.length})</button>
                <button onClick={() => setFilter('resolved')} style={{backgroundColor: filter === 'resolved' ? '#1DB954' : 'white', color: filter === 'resolved' ? 'white' : '#7A7A7A'}} className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>Resolved ({resolvedTickets.length})</button>
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
              <div className="bg-white rounded-xl shadow-md p-12 text-center"><FileText className="w-16 h-16 mx-auto text-[#7A7A7A] mb-4" /><h3 className="text-[#1E1E1E] mb-2">No tickets found</h3><p className="text-[#7A7A7A]">You haven't submitted any tickets in this category yet.</p></div>
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
                      <th scope="col" className="px-6 py-3"><div className="flex items-center justify-center">Notes</div></th>
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
                                    ticket.status === 'submitted' ? 'bg-[#FFC107]' :
                                    ticket.status === 'requested' ? 'bg-[#1DB954]' :
                                    ticket.status === 'in-progress' ? 'bg-[#3942A7]' :
                                    ticket.status === 'pending-resolution' ? 'bg-[#FFC107]' :
                                    ticket.status === 'resolved' ? 'bg-[#1DB954]' :
                                    ticket.status === 'pending-confirmation' ? 'bg-[#FFC107]' :
                                    'bg-[#FF4D4F]'
                                }`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            {ticket.status === 'rejected' && ticket.rejectionNote && <p>Rejection: {ticket.rejectionNote}</p>}
                            {(ticket.status === 'resolved' || ticket.status === 'pending-resolution' || ticket.status === 'pending-confirmation') && ticket.resolutionNote && <p>Resolution: {ticket.resolutionNote}</p>}
                          </div>
                        </td>
                         <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            {ticket.status === 'pending-resolution' && (
                              <Button onClick={() => handleConfirmResolution(ticket.id)} variant="success">Confirm Resolution</Button>
                            )}
                            {ticket.status === 'pending-confirmation' && (
                              <Button variant="success" disabled>Pending Resolution</Button>
                            )}
                            {ticket.status === 'resolved' && (
                              <Button onClick={() => handleDeleteTicket(ticket.id)} variant="destructive"><Trash2 className="w-4 h-4 mr-2"/>Delete</Button>
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

        {/* Report tab removed */}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <SettingsPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
