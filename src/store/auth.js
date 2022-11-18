import { defineStore } from "pinia";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../firebaseInit.js";
import { getRolesFromAdminCollection, addUserToRequests } from "../helpers/index.js";
import { useRouter } from 'vue-router';
import emailjs from 'emailjs-com';

export const useAuthStore = () => {
  const router = useRouter();
  return defineStore({
    // id is required so that Pinia can connect the store to the devtools
    id: "authStore",
    state: () => {
      return {
        firebaseUser: null,
        uid: null,
        email: null,
        isAuthenticated: false,
        roles: null,
        homepageReady: true,
      };
    },
    getters: {
      canRead: (state) => Boolean(state.roles?.admin || state.roles?.researcher),
      hasRequested: (state) => Boolean(state.roles?.request),
    },
    actions: {
      async setRoles() {
        this.roles = await getRolesFromAdminCollection(this.uid);
      },
      async registerWithEmailAndPassword({ email, password }) {
        this.homepageReady = false;
        return createUserWithEmailAndPassword(auth, email, password).then(
          (userCredential) => {
            this.user = userCredential.user;
            this.uid = userCredential.user.uid;
            this.email = email;
            router.replace({ name: 'Home' });
          }
        ).then(this.setRoles).then(() => {
          this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async logInWithEmailAndPassword({ email, password }) {
        this.homepageReady = false;
        return signInWithEmailAndPassword(auth, email, password).then(
          (userCredential) => {
            this.user = userCredential.user;
            this.uid = userCredential.user.uid;
            this.email = email;
            router.replace({ name: 'Home' });
          }
        ).then(this.setRoles).then(() => {
          this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async signInWithGooglePopup() {
        this.homepageReady = false;
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).then((result) => {
          // This gives you a Google Access Token. You can use it to access the Google API.
          const credential = GoogleAuthProvider.credentialFromResult(result);

          // The signed-in user info.
          this.firebaseUser = result.user;
          this.uid = result.user.uid;
          this.email = result.user.email;
          router.replace({ name: 'Home' });
        }).catch((error) => {
          const allowedErrors = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user'];
          if (!allowedErrors.includes(error.code)) {
            throw error;
          }
        }).then(this.setRoles).then(() => {
          this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async signInWithGoogleRedirect() {
        const provider = new GoogleAuthProvider();

        return signInWithRedirect(auth, provider);
      },
      async initStateFromRedirect() {
        return getRedirectResult(auth).then((result) => {
          if (result !== null) {
            this.homepageReady = false;
            // This gives you a Google Access Token. You can use it to access Google APIs.
            // const credential = GoogleAuthProvider.credentialFromResult(result);
            // const token = credential.accessToken;

            // The signed-in user info.
            this.firebaseUser = result.user;
            this.uid = result.user.uid;
            this.email = result.user.email;
            router.replace({ name: 'Home' });
            return this.setRoles().then(() => {
              this.isAuthenticated = true;
              this.homepageReady = true;
            });
          }
        }).catch((error) => {
          if (error.code == 'auth/web-storage-unsupported') {
            router.replace({ name: 'EnableCookies' });
          } else {
            throw error;
          }
        });
      },
      async signOut() {
        this.homepageReady = false;
        return auth.signOut().then(() => {
          this.uid = null;
          this.firebaseUser = null;
          this.email = null;
          this.roles = null;
          this.isAuthenticated = false;
          this.homepageReady = true;
        });
      },
      async requestAccess() {
        emailjs.init('aTzH_RwYwuqBh_9EU');
        const serviceId = 'service_2lrq22a';
        const templateId = 'template_jr6dh6m';
        const templateParams = {
          from_name: this.firebaseUser.displayName,
          uid: this.uid,
          email: this.email,
          reply_to: this.email,
        }
        emailjs.send(serviceId, templateId, templateParams).then(
          (response) => { console.log('Success!', response.status, response.text); },
          (error) => { console.log('Error...', error); }
        );
        
        addUserToRequests(this.uid);
        await this.setRoles();
      },
    },
  })();
};
