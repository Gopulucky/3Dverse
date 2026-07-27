'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StudioShell } from '@/components/layout/studio-shell';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/stores/auth-store';
import { Send, User, CheckCircle, Clock, Box, CircleDollarSign, ShieldCheck, Loader2, Paperclip, Smile, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const EMPTY_CERT_FORM = {
  material_cost: '',
  labor_cost: '',
  machine_time_cost: '',
  overhead_cost: '',
  print_duration: '',
  suggested_unit_price: '',
  notes: '',
};

export default function TicketChatPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const router = useRouter();
  const { user } = useRequireAuth();
  const { ticketId } = use(params);

  const [data, setData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [certForm, setCertForm] = useState(EMPTY_CERT_FORM);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchTicketDetails = async () => {
    try {
      setData(await api.get<any>(`/api/collaboration/tickets/${ticketId}`));
    } catch (e) {
      console.error('Error fetching ticket', e);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessages(await api.get<any[]>(`/api/collaboration/tickets/${ticketId}/messages`));
    } catch (e) {
      console.error('Error fetching messages', e);
    }
  };

  useEffect(() => {
    Promise.all([fetchTicketDetails(), fetchMessages()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchMessages();
      fetchTicketDetails();
    }, 5000);
    return () => clearInterval(interval);
  }, [ticketId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await api.post(`/api/collaboration/tickets/${ticketId}/messages`, { content: newMessage });
      setNewMessage('');
      fetchMessages();
      fetchTicketDetails();
    } catch (e) {
      console.error('Error sending message', e);
    }
  };

  const [samplePhoto, setSamplePhoto] = useState<File | null>(null);

  const handleSubmitCertification = async () => {
    if (!certForm.material_cost || !certForm.labor_cost || !certForm.machine_time_cost || !certForm.overhead_cost || !certForm.print_duration) {
      alert('Material, labor, machine time, overhead cost and print duration are required.');
      return;
    }
    setCertSubmitting(true);
    try {
      const params = new URLSearchParams({
        material_cost: certForm.material_cost,
        labor_cost: certForm.labor_cost,
        machine_time_cost: certForm.machine_time_cost,
        overhead_cost: certForm.overhead_cost,
        print_duration: certForm.print_duration,
      });
      if (certForm.suggested_unit_price) params.set('suggested_unit_price', certForm.suggested_unit_price);
      if (certForm.notes) params.set('notes', certForm.notes);

      const formData = new FormData();
      if (samplePhoto) formData.append('file', samplePhoto);

      await api.upload(`/api/collaboration/tickets/${ticketId}/certify?${params.toString()}`, formData);
      setCertForm(EMPTY_CERT_FORM);
      setSamplePhoto(null);
      await Promise.all([fetchTicketDetails(), fetchMessages()]);
    } catch (e: any) {
      console.error('Error submitting certification', e);
      alert(e.message || 'Failed to submit certification');
    } finally {
      setCertSubmitting(false);
    }
  };

  const handleConfirmAgreement = async () => {
    const finalPrice = data?.certification_report?.suggested_unit_price || 15.0;
    try {
      await api.post(`/api/collaboration/tickets/${ticketId}/agree`, { final_unit_price: finalPrice });
      fetchTicketDetails();
    } catch (e) {
      console.error('Error confirming agreement', e);
    }
  };

  if (loading) {
    return (
      <StudioShell>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Connecting to chat...</p>
          </div>
        </div>
      </StudioShell>
    );
  }

  if (!data) {
    return (
      <StudioShell>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30">
          <div className="bg-card rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl border border-border">
            <ShieldCheck className="w-12 h-12 text-muted-foreground" />
            <p className="text-foreground font-medium">Ticket not found or unauthorized.</p>
          </div>
        </div>
      </StudioShell>
    );
  }

  const { ticket, certification_report, agreement, partner_name } = data;
  const currentUserId = Number(localStorage.getItem('userId')) || ticket.creator_id;
  const isPartner = user?.role === 'print_partner';
  const needsCertification =
    isPartner && !certification_report && ['design_submitted', 'sample_printing'].includes(ticket.workflow_status);

  return (
    <StudioShell>
      <div className="h-[calc(100vh-4rem)] bg-muted/30 text-foreground flex justify-center">
        
        {/* Main UI Container */}
        <div className="w-full max-w-7xl h-full flex bg-background shadow-lg border-l border-r border-border">
          
          {/* Chat Section */}
          <div className="flex-1 flex flex-col h-full relative border-r border-border">
            
            {/* Header */}
            <div className="h-16 px-6 bg-card flex items-center justify-between flex-shrink-0 z-10 border-b border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-surface flex items-center justify-center text-primary-ink font-bold">
                  {partner_name?.charAt(0) || 'P'}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    {partner_name}
                    <Badge variant="secondary" className="text-[10px] py-0">Ticket #{ticket.id}</Badge>
                  </h2>
                  <p className="text-[13px] text-muted-foreground flex items-center gap-2 mt-0.5 font-medium">
                    <span className="flex items-center gap-1 capitalize"><Hash className="w-3 h-3"/> {ticket.workflow_status.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>Fee: ${ticket.ticket_fee}</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="flex justify-center mt-10">
                  <div className="bg-muted text-muted-foreground px-6 py-4 rounded-xl text-center max-w-sm border border-border">
                    <p className="text-sm">This is the beginning of your negotiation with <span className="font-semibold">{partner_name}</span>.</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMine = msg.sender_id === currentUserId;
                  const prevMsg = messages[index - 1];
                  const showTail = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} ${showTail ? 'mt-4' : 'mt-1'}`}
                    >
                      <div 
                        className={`relative max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                          isMine 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-card text-foreground border border-border'
                        } rounded-2xl ${
                          showTail && isMine ? 'rounded-br-sm' :
                          showTail && !isMine ? 'rounded-bl-sm' : ''
                        }`}
                      >
                        <span className="break-words block">{msg.content}</span>
                        <div className={`text-[11px] mt-1 text-right ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="p-4 bg-card border-t border-border flex items-end gap-3 shadow-sm z-10">
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                <Input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-12 bg-muted/50 border-border focus-visible:ring-primary rounded-xl px-4"
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim()}
                  className="h-12 w-12 rounded-xl flex items-center justify-center p-0"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Info Panel */}
          {(certification_report || ticket.workflow_status === 'negotiating' || ticket.workflow_status === 'certified' || needsCertification) && (
            <div className="hidden lg:flex w-[380px] xl:w-[420px] flex-col bg-muted/20 h-full overflow-y-auto">
              <div className="h-16 px-6 bg-card flex items-center border-b border-border sticky top-0 z-10 shadow-sm">
                <h2 className="text-base font-semibold text-foreground">Agreement Details</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Certification Form */}
                {needsCertification && (
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-5 text-primary flex items-center gap-2 font-display uppercase tracking-wider">
                      <Box className="w-4 h-4" /> Certify Sample Print
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'material_cost', label: 'Material cost ($)' },
                        { key: 'labor_cost', label: 'Labor cost ($)' },
                        { key: 'machine_time_cost', label: 'Machine time cost ($)' },
                        { key: 'overhead_cost', label: 'Overhead cost ($)' },
                        { key: 'print_duration', label: 'Print duration (min)' },
                        { key: 'suggested_unit_price', label: 'Suggested price ($, opt)' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-[13px] font-medium text-muted-foreground block mb-1.5">{label}</label>
                          <Input
                            type="number"
                            value={(certForm as any)[key]}
                            onChange={(e) => setCertForm({ ...certForm, [key]: e.target.value })}
                            className="bg-background h-9"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-[13px] font-medium text-muted-foreground block mb-1.5">Notes (optional)</label>
                        <textarea
                          value={certForm.notes}
                          onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleSubmitCertification}
                        disabled={certSubmitting}
                        className="w-full mt-2"
                      >
                        {certSubmitting ? 'Submitting…' : 'Submit Certification'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Certification Report Panel */}
                {certification_report && (
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-5 text-foreground flex items-center gap-2 font-display uppercase tracking-wider">
                      <Box className="w-4 h-4 text-primary" /> Certification Report
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Material Cost</span>
                        <span className="text-foreground font-medium">${certification_report.material_cost}</span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Labor Cost</span>
                        <span className="text-foreground font-medium">${certification_report.labor_cost}</span>
                      </div>
                      
                      <div className="h-px bg-border my-4" />
                      
                      <div className="flex justify-between items-center font-semibold text-foreground">
                        <span>Total Mfg Cost</span>
                        <span>${certification_report.total_manufacturing_cost}</span>
                      </div>
                      
                      <div className="mt-6 p-4 rounded-xl bg-primary-surface border border-primary/20 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-primary-ink font-medium">
                          <CircleDollarSign className="w-4 h-4" />
                          <span>Suggested Price</span>
                        </div>
                        <span className="font-bold text-primary-ink text-lg">${certification_report.suggested_unit_price || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Finalize Agreement */}
                {(ticket.workflow_status === 'negotiating' || ticket.workflow_status === 'certified') && (
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2 font-display uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-success" /> Finalize Agreement
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      Both parties must confirm the final unit price to formally activate the partnership.
                    </p>
                    
                    <Button 
                      onClick={handleConfirmAgreement}
                      className="w-full bg-success hover:bg-success/90 text-success-foreground"
                    >
                      Confirm Agreement
                    </Button>
                    
                    {agreement && (
                      <div className="mt-6 space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground font-medium">Creator Approval</span>
                          {agreement.creator_confirmed ? (
                            <span className="flex items-center gap-1 text-success font-semibold"><CheckCircle className="w-4 h-4"/> Ready</span>
                          ) : (
                            <span className="flex items-center gap-1 text-warning font-semibold"><Clock className="w-4 h-4"/> Pending</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground font-medium">Partner Approval</span>
                          {agreement.partner_confirmed ? (
                            <span className="flex items-center gap-1 text-success font-semibold"><CheckCircle className="w-4 h-4"/> Ready</span>
                          ) : (
                            <span className="flex items-center gap-1 text-warning font-semibold"><Clock className="w-4 h-4"/> Pending</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
