import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
// import admin from '../../../src/config/firebaseRoar'

const firebaseConfig = {
  apiKey: 'AIzaSyCl-JsYraUfofQZXpzshQ6s-E0nYzlCvvg',

  authDomain: 'gse-roar-admin-dev.firebaseapp.com',

  projectId: 'gse-roar-admin-dev',

  storageBucket: 'gse-roar-admin-dev.appspot.com',

  messagingSenderId: '401455396681',

  appId: '1:401455396681:web:859ea073a116d0aececc98',
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const currentTime = Timestamp.now();

export const getOpenAdministrations = async () => {
  const admins = [];
  const administrationsRef = collection(db, 'administrations');
  const q = query(administrationsRef, where('dateClosed', '>=', currentTime));

  const querySnapshot = await getDocs(q);

  for (const snapShot of querySnapshot.docs) {
    admins.push(snapShot.id);
  }
  return admins;
};
