<template>
  <div>Ya digg</div>
</template>

<script setup>
import { onMounted, ref, toRaw, onBeforeUnmount } from 'vue';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

// Your Firebase configuration
// const appConfig = {
//   apiKey: 'AIzaSyC9IoJBEyN-BxHobeoMQRuEu0CtyQDOg8k',
//   authDomain: 'hs-levante-assessment-dev.firebaseapp.com',
//   projectId: 'hs-levante-assessment-dev',
//   storageBucket: 'hs-levante-assessment-dev.appspot.com',
//   messagingSenderId: '46792247600',
//   appId: '1:46792247600:web:ea20e1fe94e0541dd5a0f5',
// };

onMounted(async () => {
  //  const authStore = useAuthStore();
  //  const { roarfirekit } = storeToRefs(authStore);

  // Initialize Firebase
  // const app = await initializeApp(appConfig);

  // // Initialize services
  // const auth = await getAuth(app);
  // connectAuthEmulator(auth, "http://localhost:9099");
  // console.log("Auth:", auth)
  // const db = await getFirestore(app);
  // connectFirestoreEmulator(db, 'localhost', 8080);

  // //   await auth.signOut();
  // sessionStorage.clear();

  // signInWithEmailAndPassword(auth, 'philipz4848+test4@gmail.com', 'password')

  // await new Promise(resolve => setTimeout(resolve, 5000));

  // {structuredQuery: {from: [{collectionId: 'variants', allDescendants: true}]}}
  // console.log("Roarfirekit:", roarfirekit.value.idToken)
  // console.log('Authstore:', authStore)

  // const testOptions = {
  //     baseURL: 'https://firestore.googleapis.com/v1/projects/hs-levante-assessment-dev/databases/(default)/documents',
  //     headers: {
  //       Authorization: `Bearer ${roarfirekit.value.idToken}`,
  //     },
  // };

  // const axiosInstance = axios.create(testOptions)

  // 'http://localhost:8083/v1/projects/demo-gse-roar-assessment/databases/(default)/documents/tasks'
  try {
    await axios
      .get('https://firestore.googleapis.com/v1/projects/hs-levante-assessment-dev/databases/(default)/documents/tasks')
      .then((response) => {
        console.log('Variants data:', response.data);
      });
  } catch (error) {
    console.error('Error:', error);
  }
});
</script>
