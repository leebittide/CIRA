import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Clock, CheckCircle, AlertCircle, FileText, Settings as SettingsIcon, Search, ClipboardList, XCircle, Check, X } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { TicketForm } from '../tickets/TicketForm';
import { SettingsPage } from '../settings/SettingsPage';
import { useToast } from '../ui/toast-container';
import { Button } from '../ui/button';

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

interface ClassRepDashboardProps {
  logoClickTime: number;
  profileClickTime: number;
}
export const ClassRepDashboard: React.FC<ClassRepDashboardProps> = ({ logoClickTime, profileClickTime }) => {
  const [allTickets, setAllTickets] = useState<TicketType[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'review' | 'report' | 'settings'>('my-tickets');
  const [myTicketsFilter, setMyTicketsFilter] = useState<'all' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'pending-confirmation'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'submitted' | 'requested' | 'in-progress' | 'pending-resolution' | 'resolved' | 'pending-confirmation'>('all');
  const [searchField, setSearchField] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [rejectionNote, setRejectionNote] = useState<{ [key: string]: string }>({});
  const [showRejectionNote, setShowRejectionNote] = useState<{ [key: string]: boolean }>({});
  const { showToast } = useToast();

  useEffect(() => {
    if (logoClickTime > 0) {
      setActiveTab('my-tickets');
      setMyTicketsFilter('all');
      setReviewFilter('all');
    }
  }, [logoClickTime]);

  useEffect(() => {
    if (profileClickTime > 0) {
      setActiveTab('settings');
    }
  }, [profileClickTime]);


  useEffect(() => {
    const ticketsCollection = collection(db, 'tickets');
    const q = query(ticketsCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ticketsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as TicketType[];
      setAllTickets(ticketsData);
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

  const handleRequest = async (ticketId: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, { status: 'requested', requestedAt: new Date() });
      showToast('Ticket requested successfully', 'success');
    } catch (error) {
      showToast('Failed to request ticket', 'error');
    }
  };

  const handleReject = async (ticketId: string) => {
    const note = rejectionNote[ticketId];
    if (!note || note.trim() === '') {
      showToast('Please provide a reason for rejecting the ticket.', 'error');
      return;
    }

    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, { status: 'rejected', rejectionNote: note });
      showToast('Ticket rejected', 'info');
      setRejectionNote(prev => {
        const updated = { ...prev };
        delete updated[ticketId];
        return updated;
      });
      setShowRejectionNote(prev => ({ ...prev, [ticketId]: false }));
    } catch (error) {
      showToast('Failed to reject ticket', 'error');
    }
  };

  const handleConfirmResolution = async (ticketId: string) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, { status: 'resolved' });
      showToast('Ticket resolution confirmed', 'success');
    } catch (error) {
      showToast('Failed to confirm ticket resolution', 'error');
    }
  };

  const getUniqueValues = (field: keyof TicketType, tickets: TicketType[]) => {
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

  const currentUser = auth.currentUser;
  const myTickets = allTickets.filter(t => t.userId === currentUser?.uid);
  const reviewTickets = allTickets.filter(t => t.userId !== currentUser?.uid);

  const filteredMyTickets = myTickets
    .filter(ticket => myTicketsFilter === 'all' || ticket.status === myTicketsFilter)
    .filter(ticket => {
        if (searchField === 'all' || !searchValue) return true;
        const fieldValue = ticket[searchField as keyof TicketType];
        if (searchField === 'requestedAt' && fieldValue instanceof Date) {
            return fieldValue.toLocaleDateString() === searchValue;
        }
        return String(fieldValue).toLowerCase() === searchValue.toLowerCase();
    });

  const filteredReviewTickets = reviewTickets
    .filter(t => reviewFilter === 'all' || t.status === reviewFilter)
    .filter(ticket => {
        if (searchField === 'all' || !searchValue) return true;
        const fieldValue = ticket[searchField as keyof TicketType];
        if (searchField === 'requestedAt' && fieldValue instanceof Date) {
            return fieldValue.toLocaleDateString() === searchValue;
        }
        return String(fieldValue).toLowerCase() === searchValue.toLowerCase();
    });

  const submittedReviewTickets = reviewTickets.filter(t => t.status === 'submitted');
  const requestedReviewTickets = reviewTickets.filter(t => t.status === 'requested');
  const inProgressReviewTickets = reviewTickets.filter(t => t.status === 'in-progress');
  const requestForValidationReviewTickets = reviewTickets.filter(t => t.status === 'pending-confirmation');
  const resolvedReviewTickets = reviewTickets.filter(t => t.status === 'resolved');

  const stats = [
    { label: 'Submitted for Review', count: submittedReviewTickets.length, icon: Clock, color: 'bg-[#FFC107]', status: 'submitted' as const },
    { label: 'Requested', count: requestedReviewTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'requested' as const },
    { label: 'In Progress', count: inProgressReviewTickets.length, icon: AlertCircle, color: 'bg-[#3942A7]', status: 'in-progress' as const },
    { label: 'Request for Resolution', count: requestForValidationReviewTickets.length, icon: Clock, color: 'bg-[#FFC107]', status: 'pending-confirmation' as const },
    { label: 'Resolved', count: resolvedReviewTickets.length, icon: CheckCircle, color: 'bg-[#1DB954]', status: 'resolved' as const },
  ];

  const tabs = [
    { id: 'my-tickets', label: 'My Tickets', icon: Ticket },
    { id: 'review', label: 'Review Tickets', icon: ClipboardList },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const requestedMyTickets = myTickets.filter(t => t.status === 'requested');
  const inProgressMyTickets = myTickets.filter(t => t.status === 'in-progress');
  const pendingResolutionMyTickets = myTickets.filter(t => t.status === 'pending-resolution');
  const resolvedMyTickets = myTickets.filter(t => t.status === 'resolved');

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-[#1E1E1E] mb-2">Class Representative Dashboard</h1>
        <p className="text-[#7A7A7A]">Manage tickets and review student submissions</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => { setActiveTab('review'); setReviewFilter(stat.status); }}
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
        {activeTab === 'my-tickets' && (
          <motion.div key="my-tickets" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                  onClick={() => setMyTicketsFilter('all')}
                  style={{backgroundColor: myTicketsFilter === 'all' ? '#1B1F50' : 'white', color: myTicketsFilter === 'all' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  All ({myTickets.length})
                </button>
                <button
                  onClick={() => setMyTicketsFilter('requested')}
                  style={{backgroundColor: myTicketsFilter === 'requested' ? '#1DB954' : 'white', color: myTicketsFilter === 'requested' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Requested ({requestedMyTickets.length})
                </button>
                <button
                  onClick={() => setMyTicketsFilter('in-progress')}
                  style={{backgroundColor: myTicketsFilter === 'in-progress' ? '#3942A7' : 'white', color: myTicketsFilter === 'in-progress' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  In Progress ({inProgressMyTickets.length})
                </button>
                 <button
                  onClick={() => setMyTicketsFilter('pending-resolution')}
                  style={{backgroundColor: myTicketsFilter === 'pending-resolution' ? '#FFC107' : 'white', color: myTicketsFilter === 'pending-resolution' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Pending Resolution ({pendingResolutionMyTickets.length})
                </button>
                <button
                  onClick={() => setMyTicketsFilter('resolved')}
                  style={{backgroundColor: myTicketsFilter === 'resolved' ? '#1DB954' : 'white', color: myTicketsFilter === 'resolved' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Resolved ({resolvedMyTickets.length})
                </button>
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
                        {getUniqueValues(searchField as keyof TicketType, myTickets).map(value => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                )}
            </div>

            {filteredMyTickets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center"><FileText className="w-16 h-16 mx-auto text-[#7A7A7A] mb-4" /><h3 className="text-[#1E1E1E] mb-2">No tickets found</h3><p className="text-[#7A7A7A]">{`You haven't submitted any tickets in this category yet`}</p></div>
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
                    {filteredMyTickets.map((ticket, index) => (
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
                                    'bg-[#FF4D4F]'
                                }`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            {ticket.status === 'rejected' && ticket.rejectionNote && <p>Rejection: {ticket.rejectionNote}</p>}
                            {(ticket.status === 'resolved' || ticket.status === 'pending-resolution') && ticket.resolutionNote && <p>Resolution: {ticket.resolutionNote}</p>}
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

        {activeTab === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                  onClick={() => setReviewFilter('all')}
                  style={{backgroundColor: reviewFilter === 'all' ? '#1B1F50' : 'white', color: reviewFilter === 'all' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  All ({reviewTickets.length})
                </button>
                <button
                  onClick={() => setReviewFilter('submitted')}
                  style={{backgroundColor: reviewFilter === 'submitted' ? '#FFC107' : 'white', color: reviewFilter === 'submitted' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Submitted ({submittedReviewTickets.length})
                </button>
                <button
                  onClick={() => setReviewFilter('requested')}
                  style={{backgroundColor: reviewFilter === 'requested' ? '#1DB954' : 'white', color: reviewFilter === 'requested' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Requested ({requestedReviewTickets.length})
                </button>
                <button
                  onClick={() => setReviewFilter('in-progress')}
                  style={{backgroundColor: reviewFilter === 'in-progress' ? '#3942A7' : 'white', color: reviewFilter === 'in-progress' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  In Progress ({inProgressReviewTickets.length})
                </button>
                <button
                  onClick={() => setReviewFilter('pending-confirmation')}
                  style={{backgroundColor: reviewFilter === 'pending-confirmation' ? '#FFC107' : 'white', color: reviewFilter === 'pending-confirmation' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Request for Resolution ({requestForValidationReviewTickets.length})
                </button>
                <button
                  onClick={() => setReviewFilter('resolved')}
                  style={{backgroundColor: reviewFilter === 'resolved' ? '#1DB954' : 'white', color: reviewFilter === 'resolved' ? 'white' : '#7A7A7A'}}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer border border-gray-300`}>
                  Resolved ({resolvedReviewTickets.length})
                </button>
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
                        {getUniqueValues(searchField as keyof TicketType, reviewTickets).map(value => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                )}
            </div>

            {filteredReviewTickets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center"><ClipboardList className="w-16 h-16 mx-auto text-[#7A7A7A] mb-4" /><h3 className="text-[#1E1E1E] mb-2">No tickets to review</h3><p className="text-[#7A7A7A]">{`There are no ${reviewFilter} tickets to review`}</p></div>
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
                    {filteredReviewTickets.map((ticket, index) => (
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
                                ticket.status === 'pending-confirmation' ? 'bg-[#FFC107]' :
                                ticket.status === 'resolved' ? 'bg-[#1DB954]' :
                                'bg-[#FF4D4F]'
                            }`}>
                                {ticket.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-2">
                            {ticket.status === 'submitted' && (
                              <>
                                {!showRejectionNote[ticket.id] ? (
                                  <div className="flex gap-2">
                                    <Button onClick={() => handleRequest(ticket.id)} variant="success"><Check className="w-4 h-4"/><span>Request</span></Button>
                                    <Button onClick={() => setShowRejectionNote(prev => ({ ...prev, [ticket.id]: true }))} variant="destructive"><X className="w-4 h-4"/><span>Reject</span></Button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <textarea value={rejectionNote[ticket.id] || ''} onChange={(e) => setRejectionNote(prev => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Rejection Note..." className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#3942A7]" />
                                    <div className="flex gap-2">
                                      <Button onClick={() => handleReject(ticket.id)} variant="destructive" className="flex-1 justify-center">Confirm</Button>
                                      <Button onClick={() => setShowRejectionNote(prev => ({ ...prev, [ticket.id]: false }))} variant="ghost" className="flex-1 justify-center">Cancel</Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                             {ticket.status === 'pending-confirmation' && (
                              <Button onClick={() => handleConfirmResolution(ticket.id)} variant="success">Confirm Resolution</Button>
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
