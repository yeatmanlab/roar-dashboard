import { defineStore } from "pinia";
import { useRouter } from 'vue-router';
import emailjs from 'emailjs-com';
import { roarfirekit } from "../firebaseInit";
import { onAuthStateChanged } from "firebase/auth";
import firebaseConfig from "@/config/firebase";
import { RoarFirekit } from "@bdelab/roar-firekit";
import { initNewFirekit } from "../firebaseInit";
import { markRaw } from "vue";

export const useAuthStore = () => {
  const router = useRouter();
  return defineStore({
    // id is required so that Pinia can connect the store to the devtools
    id: "authStore",
    state: () => {
      return {
        adminFirebaseUser: null,
        appFirebaseUser: null,
        roles: null,
        homepageReady: true,
        roarfirekit: initNewFirekit(),
      };
    },
    getters: {
      uid: (state) => { return state.adminFirebaseUser?.uid },
      email: (state) => { return state.adminFirebaseUser?.email },
      isUserAuthedAdmin: (state) => { return Boolean(state.adminFirebaseUser) },
      isUserAuthedApp: (state) => { return Boolean(state.appFirebaseUser) }
    },
    actions: {
      isUserAuthed() {
        console.log('Final Auth Status:', Boolean(this.isUserAuthedAdmin && this.isUserAuthedApp))
        return Boolean(this.isUserAuthedAdmin && this.isUserAuthedApp)
      },
      getAdminRoles() {
        console.log('adminClaims', this.roarfirekit.adminClaims)
        return this.roarfirekit.adminClaims;
      },
      setUser() {
        onAuthStateChanged(this.roarfirekit.admin.auth, async (user) => {
          if(user){
            console.log('(Admin) onAuthState Observer: user signed in:', user)
            this.adminFirebaseUser = user;
          } else {
            console.log('(Admin) onAuthState Observer: user not logged in or created yet')
            this.adminFirebaseUser = null
          }
        })
        onAuthStateChanged(this.roarfirekit.app.auth, async (user) => {
          if(user){
            console.log('(App) onAuthState Observer: user signed in:', user)
            this.appFirebaseUser = user;
          } else {
            console.log('(App) onAuthState Observer: user not logged in or created yet')
            this.appFirebaseUser = null
          }
        })
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
        ).then(() => {
          // this.isAuthenticated = true;
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
        ).then(() => {
          // this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async signInWithGooglePopup() {
        this.homepageReady = false;
        console.log('made it to auth store')
        return this.roarfirekit.signInWithPopup('google').then(() => {
          console.log('call made, setting up other stuff')
          // this.firebaseUser = roarfirekit.app.user;
          // this.uid = roarfirekit.app.user.uid;
          // this.email = roarfirekit.app.user.email;
          console.log('auth store', this)
          router.replace({ name: 'Home' });
        }).then(() => {
          // this.isAuthenticated = true;
          this.homepageReady = true;
        });
      },
      async signInWithGoogleRedirect() {
        return roarfirekit.initiateGoogleRedirect();
      },
      async initStateFromRedirect() {
        const enableCookiesCallback = () => {
          router.replace({ name: 'EnableCookies' });
        }
        this.homepageReady = false;
        return this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then((result) => {
          if (result) {
            // this.firebaseUser = roarfirekit.app.user;
            // this.uid = roarfirekit.app.user.uid;
            // this.email = roarfirekit.app.user.email;
            router.replace({ name: 'Home' });
            // this.isAuthenticated = true;
            this.homepageReady = true;
            return;
          }
        });
      },
      async signOut() {
        if(this.isUserAuthed()){
          this.homepageReady = false;
          return this.roarfirekit.signOut().then(() => {
            // this.uid = null;
            // this.firebaseUser = null;
            // this.email = null;
            this.roles = null;
            // this.isAuthenticated = false;
            this.homepageReady = true;
            // roarfirekit = this.initNewFirekit()
          });
        } else {
          console.log('Cant log out while not logged in')
        }
      },
      async getMyData() {
        const userData = await this.roarfirekit.getMyData()
        console.log('inside getMyData()', userData)
        return userData
      }
      // Used for requesting access when user doesn't have access to page
      // TODO: punt- thinking about moving to a ticket system instead of this solution.
      // async requestAccess() {
      //   emailjs.init('aTzH_RwYwuqBh_9EU');
      //   const serviceId = 'service_2lrq22a';
      //   const templateId = 'template_jr6dh6m';
      //   const templateParams = {
      //     from_name: this.firebaseUser.displayName,
      //     // uid: this.uid,
      //     // email: this.email,
      //     reply_to: this.email,
      //   }
      //   emailjs.send(serviceId, templateId, templateParams).then(
      //     (response) => { console.log('Success!', response.status, response.text); },
      //     (error) => { console.log('Error...', error); }
      //   );
        
      //   await roarfirekit.addUserToAdminRequests();
      //   await this.setRoles();
      // },
    },
    // persist: true
    persist: {
      storage: sessionStorage,
    },
  })();
};
