import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';

import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: 'AIzaSyChcgu2yOmsugrh2rjc9KhZWe6sD2yZqqI',
  authDomain: 'unera-50aae.firebaseapp.com',
  projectId: 'unera-50aae',
  storageBucket: 'unera-50aae.firebasestorage.app',
  messagingSenderId: '649631105841',
  appId: '1:649631105841:web:861869624fdfec132ca610'
};

export const firebaseApp =
  initializeApp(firebaseConfig);

export const messaging =
  getMessaging(firebaseApp);

export async function requestUNERAPermission() {

  try {

    const permission =
      await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('❌ Notification permission denied');
      return null;
    }

    const token = await getToken(
      messaging,
      {
        vapidKey:
          'BIuB4LE6eDkmgFQyt55TuMmDz0Kq5XtoDBdW70mOW99QB2-BQiYen-ZwoWQC_d2NerHpNwgaM-hxRGu6uBN84hA'
      }
    );

    console.log('🔥 UNERA WEB TOKEN:', token);

    return token;

  } catch (err) {

    console.error(
      '❌ UNERA notification error:',
      err
    );

    return null;
  }
}

onMessage(
  messaging,
  (payload) => {

    console.log(
      '📩 UNERA foreground push:',
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
