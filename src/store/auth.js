import { defineStore } from "pinia";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useRouter } from 'vue-router';
import emailjs from 'emailjs-com';
import { RoarFirekit } from '@bdelab/roar-firekit';
import { getRolesFromAdminCollection, addUserToRequests } from "../helpers/index";
import firebaseConfig from "../config/firebase";
import { auth } from "../firebaseInit";

export const useAuthStore = () => {
  const router = useRouter();
  return defineStore({
    // id is required so that Pinia can connect the store to the devtools
    id: "authStore",
    state: () => {
      return {
        auth: auth,
        roarfirekit: new RoarFirekit({ roarConfig: firebaseConfig }),
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
      hasRequestedAccess: (state) => Boolean(state.roles?.request),
    },
    actions: {
      async setRoles() {
        this.roles = await getRolesFromAdminCollection(this.uid);
      },
      async registerWithEmailAndPassword({ email, password }) {
        this.homepageReady = false;
        return this.roarfirekit.registerWithEmailAndPassword({ email, password }).then(
          () => {
            this.user = this.roarfirekit.app.user;
            this.uid = this.roarfirekit.app.user.uid;
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
        return this.roarfirekit.logInWithEmailAndPassword({ email, password }).then(
          () => {
            this.user = this.roarfirekit.app.user;
            this.uid = this.roarfirekit.app.user.uid;
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
        return this.roarfirekit.signInWithGooglePopup().then(() => {
          this.firebaseUser = this.app.user;
          this.uid = this.app.user.uid;
          this.email = this.app.user.email;
          router.replace({ name: 'Home' });
        }).then(this.setRoles).then(() => {
          this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async signInWithGoogleRedirect() {
        return this.roarfirekit.initiateGoogleRedirect();
      },
      async initStateFromRedirect() {
        const enableCookiesCallback = () => {
          router.replace({ name: 'EnableCookies' });
        }
        this.homepageReady = false;
        return this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then((result) => {
          if (result) {
            this.firebaseUser = this.roarfirekit.app.user;
            this.uid = this.roarfirekit.app.user.uid;
            this.email = this.roarfirekit.app.user.email;
            router.replace({ name: 'Home' });
            return this.setRoles().then(() => {
              this.isAuthenticated = true;
              this.homepageReady = true;
            });
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
