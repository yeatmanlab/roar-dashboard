import { defineStore } from "pinia";
// import { useRouter } from 'vue-router';
import { onAuthStateChanged } from "firebase/auth";
import { toRaw } from 'vue';
import { RoarFirekit } from "@bdelab/roar-firekit";
import { hydrateFirekit, initNewFirekit } from "../firebaseInit";

import _get from "lodash/get";
// import { declarePersistable, serialize, deserialize } from 'serialijse';

export const useAuthStore = () => {
  // const router = useRouter();
  return defineStore('authStore', {
    // id is required so that Pinia can connect the store to the devtools
    id: "authStore",
    state: () => {
      return {
        firebaseUser: {
          adminFirebaseUser: null,
          appFirebaseUser: null,
        },
        roles: null,
        roarfirekit: null,
        localFirekitInit: false,
        hasUserData: false,
        firekitUserData: null,
        firekitAssignments: {
          assigned: null
        }
      };
    },
    getters: {
      uid: (state) => { return state.firebaseUser.adminFirebaseUser?.uid },
      email: (state) => { return state.firebaseUser.adminFirebaseUser?.email },
      userType: (state) => { return state.roarfirekit.userData.userType },
      isUserAuthedAdmin: (state) => { return Boolean(state.firebaseUser.adminFirebaseUser) },
      isUserAuthedApp: (state) => { return Boolean(state.firebaseUser.appFirebaseUser) },
      isAuthenticated: (state) => { return (Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser))},
      isFirekitInit: (state) => { return state.roarfirekit?.initialized },
      firekitHasFunctions: (state) => { return (typeof state.roarfirekit['getAssignments'])},
      localFirekitInitGetter: (state) => { 
        console.log('[Getter] localFirekitInit:', state.localFirekitInit)
        // console.log('[Getter] hasFunctions:', typeof state.roarfirekit['getAssignments'])
        return (state.localFirekitInit) 
      },
      // User Information Getters
      adminClaims: (state) => { return state.roarfirekit?.adminClaims },
      assignedAssignments: (state) => { return state.roarfirekit.currentAssignments?.assigned },
      userData: (state) => { return state.roarfirekit?.userData }
    },
    actions: {
      async getAssignments(assignments) {
        console.log('inside authStore calling getAssignments', this.roarfirekit)
        try{
          const reply = await this.roarfirekit.getAssignments(assignments)
          this.firekitAssignments = reply
          return reply
        } catch(e) {
          return this.firekitAssignments.assigned
        }
        
      },
      getAdminRoles() {
        return this.roarfirekit?.adminClaims;
      },
      setUser() {
        onAuthStateChanged(this.roarfirekit?.admin.auth, async (user) => {
          if(user){
            console.log('Firebase User Set Up! (Admin)')
            this.localFirekitInit = true
            this.firebaseUser.adminFirebaseUser = user;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
          }
        })
        onAuthStateChanged(this.roarfirekit?.app.auth, async (user) => {
          if(user){
            console.log('Firebase User set up! (App)')
            this.firebaseUser.appFirebaseUser = user;
          } else {
            this.firebaseUser.appFirebaseUser = null;
          }
        })
      },
      async initFirekit() {
        // if(this.roarfirekit === null){
          this.roarfirekit = await initNewFirekit().then((firekit) => {
            console.log('setting up this.firekit with', firekit)
            return firekit
          });
        // } else {
        //   console.log('firekit already initalized, skipping!')
        //   console.log('current firekit', this.roarfirekit)
        // }
      },
      async registerWithEmailAndPassword({ email, password }) {
        return this.roarfirekit.registerWithEmailAndPassword({ email, password }).then(
          () => {
            this.user = this.roarfirekit?.app.user;
            this.uid = this.roarfirekit?.app.user.uid;
            this.email = email;
            // router.replace({ name: 'Home' });
          }
        ).then(() => {
        });
      },
      async logInWithEmailAndPassword({ email, password }) {
        if(this.isFirekitInit){
          return this.roarfirekit.logInWithEmailAndPassword({ email, password }).then(
            () => {
              this.user = this.roarfirekit.app.user;
              this.uid = this.roarfirekit.app.user.uid;
              this.email = email;
              // router.replace({ name: 'Home' });
            }
          ).then(() => {
          });
        }
        
      },
      async signInWithGooglePopup() {
        if(this.isFirekitInit){
          return this.roarfirekit.signInWithPopup('google').then(() => {
            if(this.roarfirekit.userData){
              this.hasUserData = true
              this.firekitUserData = this.roarfirekit.userData
            }
          })
        }
      },
      async signInWithGoogleRedirect() {
        return roarfirekit.initiateGoogleRedirect();
      },
      async initStateFromRedirect() {
        const enableCookiesCallback = () => {
          // router.replace({ name: 'EnableCookies' });
        }
        if(this.isFirekitInit){
          return this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then((result) => {
            if (result) {
              // router.replace({ name: 'Home' });
              return;
            }
          });
        }
      },
      async signOut() {
        if(this.isAuthenticated && this.isFirekitInit){
          return this.roarfirekit.signOut().then(() => {
            this.roles = null;
            this.hasUserData = false;
            // this.roarfirekit = initNewFirekit()
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
      debug: true
    },
  })();
};
