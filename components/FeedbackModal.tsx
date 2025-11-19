
import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { useAppContext } from '../App';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAppContext();
  const [feedbackType, setFeedbackType] = useState<'feature' | 'issue'>('feature');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic Validation
    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a description.' });
      return;
    }

    // Configuration Check
    const { serviceId, templateId, publicKey } = user.emailConfig || {};
    if (!serviceId || !templateId || !publicKey) {
      setStatusMessage({ type: 'error', text: 'EmailJS is not configured by Admin. Please contact support.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    const templateParams = {
      to_email: 'robert.taylor4@gmail.com',
      from_email: email || 'Anonymous',
      feedback_type: feedbackType === 'feature' ? 'Feature Recommendation' : 'Bug/Issue Report',
      message: description,
    };

    try {
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      setStatusMessage({ type: 'success', text: 'Feedback sent successfully!' });
      setTimeout(() => {
        onClose();
        // Reset form
        setDescription('');
        setEmail('');
        setFeedbackType('feature');
        setStatusMessage(null);
      }, 2000);
    } catch (error) {
      console.error('FAILED...', error);
      setStatusMessage({ type: 'error', text: 'Failed to send feedback. Please try again later.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" 
        onClick={onClose}
    >
        <div 
            className="bg-white dark:bg-[#1a1625] rounded-lg shadow-xl w-full max-w-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-purple-600 rounded-t-lg">
                <h2 className="text-xl font-bold text-white">Submit Feedback</h2>
                <button 
                    onClick={onClose} 
                    className="p-2 rounded-full text-white hover:bg-purple-700 focus:outline-none text-2xl leading-none"
                    aria-label="Close feedback"
                >
                    &times;
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {statusMessage && (
                  <div className={`p-3 rounded-md text-sm ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
                    {statusMessage.text}
                  </div>
                )}

                <div>
                  <label htmlFor="feedback-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Feedback Type
                  </label>
                  <select
                    id="feedback-type"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as 'feature' | 'issue')}
                    className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="feature">Feature Recommendation</option>
                    <option value="issue">Report a Bug / Issue</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your Email (Optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email to stay anonymous"
                    className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={feedbackType === 'feature' ? "Describe the feature you'd like to see..." : "Describe the issue and how to reproduce it..."}
                    className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={isSending}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSending && (
                           <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        )}
                        {isSending ? 'Sending...' : 'Submit Feedback'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default FeedbackModal;
