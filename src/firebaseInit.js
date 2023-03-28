import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { markRaw } from "vue";
import firebaseConfig from "./config/firebase";
import { RoarFirekit } from "@bdelab/roar-firekit";

const roarfirekit = markRaw(new RoarFirekit({ roarConfig: firebaseConfig }));
const firebaseApp = initializeApp(firebaseConfig.app, "legacy-app");

// Use markRaw to wrap the firestore instance for use in components and the
// pinia store.
// See https://vuejs.org/api/reactivity-advanced.html#markraw for general info
// about markRaw and see
// https://github.com/firebase/firebase-js-sdk/issues/6087#issuecomment-1233478793
// for a recommendation specific to Vue 3 and Firestore indexedDbPersistence
const db = markRaw(getFirestore(firebaseApp));
const auth = getAuth(firebaseApp);
const rootDoc = doc(db, "prod", "roar-prod");
const users = collection(rootDoc, "users");
const tasks = collection(rootDoc, "tasks");
const adminCollection = collection(db, "admin");

export { auth, db, rootDoc, users, tasks, adminCollection, roarfirekit };
