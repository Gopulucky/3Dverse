'use client';

import { useState, useEffect } from 'react';

export default function ExplainerModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the modal
    const hasSeenModal = localStorage.getItem('hasSeenCollaborationModal');
    if (!hasSeenModal) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenCollaborationModal', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-opacity-50 backdrop-blur-sm transition-opacity">
      <div className="bg-card border border-zinc-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-primary-foreground transform transition-all">
        <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Print Partner Collaboration
        </h2>
        <div className="space-y-4 text-zinc-300">
          <p>
            Welcome to the Collaboration hub! This feature is designed to help you manufacture your designs seamlessly.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <span className="font-semibold text-primary-foreground">Have a printer?</span> You can fulfill orders yourself.
            </li>
            <li>
              <span className="font-semibold text-primary-foreground">No printer?</span> You can collaborate with a verified print partner.
            </li>
            <li>
              <span className="font-semibold text-primary-foreground">At capacity?</span> Offload excess orders to a partner when you're busy.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground italic">
            Search for partners, buy an evaluation ticket, negotiate pricing, and formalize an agreement all in one place.
          </p>
        </div>
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-primary-foreground rounded-lg font-medium transition-all shadow-lg hover:shadow-blue-500/25"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
