import { initializeApp } from "firebase/app";
import {
  enableIndexedDbPersistence,
  getFirestore,
  doc,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "./config/firebase";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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

const auth = getAuth();
const rootDoc = doc(db, "prod", "roar-prod");
const users = collection(rootDoc, "users");
const tasks = collection(rootDoc, "tasks");
const adminCollection = collection(db, "admin");

export { auth, db, rootDoc, users, tasks, adminCollection };
