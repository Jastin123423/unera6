import { initializeApp } from 'firebase/app';

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyChcgu2yOmsugrh2rjc9KhZWe6sD2yZqqI',
  authDomain: 'unera-50aae.firebaseapp.com',
  projectId: 'unera-50aae',
  storageBucket: 'unera-50aae.firebasestorage.app',
  messagingSenderId: '649631105841',
  appId: '1:649631105841:web:861869624fdfec132ca610'
};

export const app =
  initializeApp(firebaseConfig);

export async function setupUneraPush() {

  try {

    const supported =
      await isSupported();

    if (!supported) {

      console.log(
        'UNERA push not supported'
      );

      return null;
    }

    if (
      !('Notification' in window)
    ) {

      console.log(
        'Notifications unavailable'
      );

      return null;
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== 'granted') {

      console.log(
        'Notification permission denied'
      );

      return null;
    }

    const registration =
      await navigator.serviceWorker.ready;

    const messaging =
      getMessaging(app);

    const token =
      await getToken(
        messaging,
        {
          vapidKey:
            'BIuB4LE6eDkmgFQyt55TuMmDz0Kq5XtoDBdW70mOW99QB2-BQiYen-ZwoWQC_d2NerHpNwgaM-hxRGu6uBN84hA',

          serviceWorkerRegistration:
            registration
        }
      );

    console.log(
      'UNERA WEB PUSH TOKEN:',
      token
    );

    if (!token) {
      return null;
    }

    const rawUser =
      localStorage.getItem(
        'unera_user'
      );

    const user =
      rawUser
        ? JSON.parse(rawUser)
        : null;

    if (!user?.id) {

      console.log(
        'UNERA user not logged in'
      );

      return token;
    }

    await fetch(
      '/api/push/register-token',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          user_id: user.id,

          token,

          platform: 'web',

          device_id:
            navigator.userAgent
        })
      }
    );

    console.log(
      'UNERA web push registered'
    );

    onMessage(
      messaging,
      (payload) => {

        console.log(
          'UNERA foreground push:',
          payload
        );

        window.dispatchEvent(
          new CustomEvent(
            'uneraPushMessage',
            {
              detail: payload
            }
          )
        );
      }
    );

    return token;

  } catch (err) {

    console.error(
      'UNERA push setup failed:',
      err
    );

    return null;
  }
}
