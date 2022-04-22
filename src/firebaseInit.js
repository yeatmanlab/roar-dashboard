import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "./config/firebase.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth();
const rootDoc = doc(db, "prod", "roar-prod");
const users = collection(rootDoc, "users");
const tasks = collection(rootDoc, "tasks");

export { auth, db, rootDoc, users, tasks };
