import { defineStore } from "pinia";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, users } from "../firebaseInit.js";
import { getDocsFromQuery } from "../helpers/index.js";

export const useAuthStore = defineStore({
  // id is required so that Pinia can connect the store to the devtools
  id: "authUser",
  state: () => {
    return {
      firebaseUser: null,
      uid: null,
      email: null,
      userDoc: null,
      isAuthenticated: false,
      isResearcher: false,
      isAdmin: true,
    };
  },
  getters: {},
  actions: {
    async registerWithEmailAndPassword({ email, password }) {
      return createUserWithEmailAndPassword(auth, email, password).then(
        (userCredential) => {
          this.user = userCredential.user;
          this.uid = userCredential.user.uid;
          this.email = email;
          this.isAuthenticated = true;
          this.userDoc = getDocsFromQuery(users, "firebaseUid", this.uid);
        }
      );
    },
    async logInWithEmailAndPassword({ email, password }) {
      return signInWithEmailAndPassword(auth, email, password).then(
        (userCredential) => {
          this.user = userCredential.user;
          this.uid = userCredential.user.uid;
          this.email = email;
          this.isAuthenticated = true;
          this.userDoc = getDocsFromQuery(users, "firebaseUid", this.uid);
        }
      );
    },
    async signInWithGooglePopup() {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider).then((result) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);

        // The signed-in user info.
        this.firebaseUser = result.user;
        this.uid = result.user.uid;
        this.email = result.user.email;
        this.isAuthenticated = true;
        this.userDoc = getDocsFromQuery(users, "firebaseUid", this.uid);
      });
    },
    async signInWithGoogleRedirect() {
      const provider = new GoogleAuthProvider();

      return signInWithRedirect(auth, provider).then(() => {
        getRedirectResult(auth).then((result) => {
          console.log(result);
          // This gives you a Google Access Token. You can use it to access Google APIs.
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential.accessToken;

          // The signed-in user info.
          this.firebaseUser = result.user;
          this.uid = result.user.uid;
          this.email = result.user.email;
          this.isAuthenticated = true;
          this.userDoc = getDocsFromQuery(users, "firebaseUid", this.uid);
        });
      });
    },
    async signOut({ commit }) {
      return auth.signOut().then(() => {
        this.uid = null;
        this.firebaseUser = null;
        this.email = null;
        this.isAuthenticated = false;
        this.userDoc = null;
      });
    },
  },
});
