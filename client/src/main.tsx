import { ClerkProvider } from '@clerk/clerk-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const rootElement = document.getElementById('root');

if (!clerkPublishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required.');
}

if (!rootElement) {
  throw new Error('Root element not found.');
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#329F5B',
    colorBackground: '#FFFDF9',
    colorText: '#101713',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#101713',
    colorNeutral: '#D6D7CF',
    borderRadius: '0.95rem',
    fontFamily: 'Sora, ui-sans-serif, sans-serif'
  },
  elements: {
    card: 'border border-[#d6d7cf] bg-[#fffdf9] shadow-[0_26px_55px_-36px_rgba(16,23,19,0.45)]',
    headerTitle: 'text-[#101713]',
    headerSubtitle: 'text-[#4d5f53]',
    formFieldLabel: 'text-[#233227] font-semibold',
    formFieldInput:
      'border border-[#d6d7cf] bg-white text-[#101713] focus:border-[#329F5B] focus:ring-2 focus:ring-[#329F5B]/25',
    socialButtonsBlockButton:
      'border border-[#d6d7cf] bg-white text-[#101713] hover:bg-[#f5f2ea]',
    formButtonPrimary: 'bg-[#329F5B] text-[#08110c] hover:bg-[#2b8a4e]',
    footerActionLink: 'text-[#233227] hover:text-[#329F5B]',
    dividerLine: 'bg-[#d6d7cf]',
    dividerText: 'text-[#4d5f53]'
  }
};

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
