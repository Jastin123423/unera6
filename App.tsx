// App.tsx - MINIMAL VERSION FOR DEBUGGING
import React, { useState, useEffect } from 'react';
import { useLanguage } from './contexts/LanguageContext';

export default function App() {
  useLanguage();
  
  console.log('🔵 App.tsx rendering...');
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState('home');
  
  useEffect(() => {
    console.log('🔄 App mounted');
    
    // Check for stored user
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
  }, []);
  
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#18191A] flex items-center justify-center">
        <div className="bg-[#242526] p-8 rounded-2xl">
          <h1 className="text-white text-2xl font-bold mb-4">Login Page</h1>
          <button 
            onClick={() => setView('home')}
            className="bg-[#1877F2] text-white px-6 py-2 rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#18191A] min-h-screen text-white p-4">
      <h1 className="text-2xl font-bold">UNERA Social</h1>
      <p className="text-[#B0B3B8]">App is loading...</p>
      
      <div className="mt-8">
        <button 
          onClick={() => setView('login')}
          className="bg-[#1877F2] text-white px-6 py-2 rounded-lg mr-4"
        >
          Login
        </button>
        <button 
          onClick={() => {
            localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test User' }));
            setCurrentUser({ id: 1, name: 'Test User' });
          }}
          className="bg-[#45BD62] text-white px-6 py-2 rounded-lg"
        >
          Simulate Login
        </button>
      </div>
      
      {currentUser && (
        <div className="mt-8 p-4 bg-[#242526] rounded-xl">
          <p>Logged in as: {currentUser.name}</p>
        </div>
      )}
    </div>
  );
}
