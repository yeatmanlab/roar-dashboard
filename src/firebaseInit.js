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

const firebaseApp = initializeApp(firebaseConfig.app, "legacy-app");

// Use markRaw to wrap the firestore instance for use in components and the
// pinia store.
// See https://vuejs.org/api/reactivity-advanced.html#markraw for general info
// about markRaw and see
// https://github.com/firebase/firebase-js-sdk/issues/6087#issuecomment-1233478793
// for a recommendation specific to Vue 3 and Firestore indexedDbPersistence
const db = markRaw(getFirestore(firebaseApp));

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == "failed-precondition") {
    console.log(
      "Couldn't enable indexed db persistence. This is probably because the browser has multiple roar tabs open."
    );
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a a time.
    // ...
  } else if (err.code == "unimplemented") {
    console.log(
      "Couldn't enable indexed db persistence. This is probably because the browser doesn't support it."
    );
    // The current browser does not support all of the
    // features required to enable persistence
    // ...
  }
});
// Subsequent queries will use persistence, if it was enabled successfully

const auth = getAuth(firebaseApp);
const rootDoc = doc(db, "prod", "roar-prod");
const users = collection(rootDoc, "users");
const tasks = collection(rootDoc, "tasks");
const adminCollection = collection(db, "admin");
const roarfirekit = markRaw(new RoarFirekit({ roarConfig: firebaseConfig }));

export { auth, db, rootDoc, users, tasks, adminCollection, roarfirekit };
