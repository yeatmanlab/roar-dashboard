import { initializeApp } from "firebase/app";
import {
  enableIndexedDbPersistence,
  getFirestore,
  doc,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { markRaw } from "vue";
import firebaseConfig from "./config/firebase";
import { RoarFirekit } from "@bdelab/roar-firekit";

// Use markRaw to wrap the firestore instance for use in components and the
// pinia store.
// See https://vuejs.org/api/reactivity-advanced.html#markraw for general info
// about markRaw and see
// https://github.com/firebase/firebase-js-sdk/issues/6087#issuecomment-1233478793
// for a recommendation specific to Vue 3 and Firestore indexedDbPersistence
const roarfirekit = markRaw(new RoarFirekit({ roarConfig: firebaseConfig }));
console.log(roarfirekit.app.db);

export { roarfirekit };
