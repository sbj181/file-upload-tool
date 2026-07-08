"use client"; // Ensure it's a Client Component

import React, { useEffect } from 'react';

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement | null, options: RenderButtonOptions) => void;
        };
      };
    };
  }
}

interface RenderButtonOptions {
  theme: 'outline' | 'filled_blue' | 'filled_black';
  size: 'small' | 'medium' | 'large';
  text?: string;
  shape?: 'rectangular' | 'pill';
  logo_alignment?: 'left' | 'center';
  [key: string]: unknown; // Allow for any other additional properties
}

interface GoogleSignInProps {
  onSignIn: (token: string) => void;
}

const GoogleSignIn: React.FC<GoogleSignInProps> = ({ onSignIn }) => {
  useEffect(() => {
    const loadGoogleScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    };

    const initializeGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '', // Use your Google Client ID
          callback: handleCredentialResponse,
        });

        window.google.accounts.id.renderButton(
          document.getElementById('signInDiv'),
          {
            theme: 'outline',
            size: 'large',
          }
        );
      }
    };

    const handleCredentialResponse = async (response: { credential: string }) => {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (res.ok) onSignIn(response.credential);
      else alert('Only @thegrovery.com accounts can view files.');
    };

    loadGoogleScript();
  }, [onSignIn]);

  return <div className='mt-2 flex w-full justify-center' id="signInDiv"></div>; // This is where the Google Sign-In button will appear
};

export default GoogleSignIn;
