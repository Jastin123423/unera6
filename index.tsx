import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);

/* =========================================
   UNERA SERVICE WORKER
========================================= */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {

      const registration =
        await navigator.serviceWorker.register('/sw.js');

      console.log(
        '✅ UNERA SW registered:',
        registration.scope
      );

      /* =========================================
         FORCE WAITING SW TO ACTIVATE
      ========================================= */

      if (registration.waiting) {
        registration.waiting.postMessage({
          type: 'SKIP_WAITING',
        });
      }

      /* =========================================
         LISTEN FOR NEW SW
      ========================================= */

      registration.addEventListener(
        'updatefound',
        () => {

          const newWorker =
            registration.installing;

          if (!newWorker) return;

          console.log(
            '⬇️ New UNERA update found'
          );

          newWorker.addEventListener(
            'statechange',
            () => {

              console.log(
                'SW STATE:',
                newWorker.state
              );

              if (
                newWorker.state ===
                  'installed' &&
                navigator.serviceWorker.controller
              ) {

                console.log(
                  '🔄 UNERA updated'
                );

                /* =========================================
                   OPTIONAL:
                   SHOW UPDATE UI IN FUTURE
                ========================================= */

                window.dispatchEvent(
                  new CustomEvent(
                    'uneraUpdateAvailable'
                  )
                );

                /* =========================================
                   AUTO REFRESH
                ========================================= */

                window.location.reload();
              }
            }
          );
        }
      );

      /* =========================================
         SW MESSAGE CHANNEL
      ========================================= */

      navigator.serviceWorker.addEventListener(
        'message',
        (event) => {

          console.log(
            '📩 SW MESSAGE:',
            event.data
          );

          window.dispatchEvent(
            new CustomEvent(
              'uneraSWMessage',
              {
                detail: event.data,
              }
            )
          );
        }
      );

      /* =========================================
         ONLINE / OFFLINE EVENTS
      ========================================= */

      window.addEventListener(
        'online',
        () => {
          console.log(
            '🌐 UNERA back online'
          );

          window.dispatchEvent(
            new CustomEvent(
              'uneraOnline'
            )
          );
        }
      );

      window.addEventListener(
        'offline',
        () => {
          console.log(
            '📴 UNERA offline'
          );

          window.dispatchEvent(
            new CustomEvent(
              'uneraOffline'
            )
          );
        }
      );

      /* =========================================
         PWA INSTALL READY EVENT
      ========================================= */

      window.addEventListener(
        'beforeinstallprompt',
        (event: any) => {

          console.log(
            '📲 UNERA install available'
          );

          event.preventDefault();

          (window as any).deferredPrompt =
            event;

          window.dispatchEvent(
            new CustomEvent(
              'uneraInstallReady'
            )
          );
        }
      );

      /* =========================================
         PWA INSTALLED EVENT
      ========================================= */

      window.addEventListener(
        'appinstalled',
        () => {

          console.log(
            '🎉 UNERA installed'
          );

          window.dispatchEvent(
            new CustomEvent(
              'uneraInstalled'
            )
          );
        }
      );

    } catch (err) {

      console.error(
        '❌ UNERA SW registration failed:',
        err
      );
    }
  });
}
