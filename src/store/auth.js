import { defineStore } from "pinia";
import { useRouter } from 'vue-router';
import { onAuthStateChanged } from "firebase/auth";
import { initNewFirekit } from "../firebaseInit";

export const useAuthStore = () => {
  const router = useRouter();
  return defineStore({
    // id is required so that Pinia can connect the store to the devtools
    id: "authStore",
    state: () => {
      return {
        firebaseUser: {
          adminFirebaseUser: null,
          appFirebaseUser: null,
        },
        roles: null,
        homepageReady: true,
        roarfirekit: null,
      };
    },
    getters: {
      uid: (state) => { return state.firebaseUser.adminFirebaseUser?.uid },
      email: (state) => { return state.firebaseUser.adminFirebaseUser?.email },
      isUserAuthedAdmin: (state) => { return Boolean(state.firebaseUser.adminFirebaseUser) },
      isUserAuthedApp: (state) => { return Boolean(state.firebaseUser.appFirebaseUser) },
      isAuthenticated: (state) => { return (Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser))},
      isFirekitInit: (state) => { return Boolean(state.roarfirekit) },
      // User Information Getters
      adminClaims: (state) => { return state.roarfirekit?.adminClaims },
      currentAssignments: (state) => { return state.roarfirekit?.currentAssignments },
      userData: (state) => { return state.roarfirekit?.userData }
    },
    actions: {
      getAdminRoles() {
        console.log('adminClaims', this.roarfirekit?.adminClaims)
        return this.roarfirekit?.adminClaims;
      },
      setUser() {
        onAuthStateChanged(this.roarfirekit?.admin.auth, async (user) => {
          if(user){
            // console.log('(Admin) onAuthState Observer: user signed in:', user)
            this.firebaseUser.adminFirebaseUser = user;
          } else {
            // console.log('(Admin) onAuthState Observer: user not logged in or created yet')
            this.firebaseUser.adminFirebaseUser = null;
          }
        })
        onAuthStateChanged(this.roarfirekit?.app.auth, async (user) => {
          if(user){
            // console.log('(App) onAuthState Observer: user signed in:', user)
            this.firebaseUser.appFirebaseUser = user;
          } else {
            // console.log('(App) onAuthState Observer: user not logged in or created yet')
            this.firebaseUser.appFirebaseUser = null;
          }
        })
      },
      async initFirekit() {
        this.roarfirekit = await initNewFirekit();
      },
      async registerWithEmailAndPassword({ email, password }) {
        this.homepageReady = false;
        return this.roarfirekit.registerWithEmailAndPassword({ email, password }).then(
          () => {
            this.user = this.roarfirekit?.app.user;
            this.uid = this.roarfirekit?.app.user.uid;
            this.email = email;
            router.replace({ name: 'Home' });
          }
        ).then(() => {
          this.homepageReady = true;
        });
      },
      async logInWithEmailAndPassword({ email, password }) {
        this.homepageReady = false;
        if(this.isFirekitInit){
          return this.roarfirekit.logInWithEmailAndPassword({ email, password }).then(
            () => {
              this.user = this.roarfirekit.app.user;
              this.uid = this.roarfirekit.app.user.uid;
              this.email = email;
              router.replace({ name: 'Home' });
            }
          ).then(() => {
            this.homepageReady = true;
          });
        }
        
      },
      async signInWithGooglePopup() {
        this.homepageReady = false;
        if(this.isFirekitInit){
          return this.roarfirekit.signInWithPopup('google').then(() => {
            router.replace({ name: 'Home' });
          }).then(() => {
            this.homepageReady = true;
          });
        }
      },
      async signInWithGoogleRedirect() {
        return roarfirekit.initiateGoogleRedirect();
      },
      async initStateFromRedirect() {
        const enableCookiesCallback = () => {
          router.replace({ name: 'EnableCookies' });
        }
        this.homepageReady = false;
        if(this.isFirekitInit){
          return this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then((result) => {
            if (result) {
              router.replace({ name: 'Home' });
              this.homepageReady = true;
              return;
            }
          });
        }
      },
      async signOut() {
        if(this.isAuthenticated && this.isFirekitInit){
          this.homepageReady = false;
          return this.roarfirekit.signOut().then(() => {
            this.roles = null;
            this.homepageReady = true;
            // roarfirekit = this.initNewFirekit()
          });
        } else {
          console.log('Cant log out while not logged in')
        }
      },
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
