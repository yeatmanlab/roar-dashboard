import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
// import admin from '../../../src/config/firebaseRoar'

const firebaseConfig = {
  apiKey: 'AIzaSyBz0CTdyfgNXr7VJqcYOPlG609XDs97Tn8',

  authDomain: 'gse-roar-admin.firebaseapp.com',

  projectId: 'gse-roar-admin',

  storageBucket: 'gse-roar-admin.appspot.com',

  messagingSenderId: '1062489366521',

  appId: '1:1062489366521:web:d0b8b5371a67332d1d2728',

  measurementId: 'G-YYE3YN0S99',
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
