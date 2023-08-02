import { defineStore } from "pinia";
import { onAuthStateChanged } from "firebase/auth";
import { initNewFirekit } from "../firebaseInit";

import _get from "lodash/get";

export const useAuthStore = () => {
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
        hasUserData: false,
        firekitUserData: null,
        firekitAssignments: {
          assigned: null
        },
        firekitAssignmentIds: null,
        cleverOAuthRequested: false,
      };
    },
    getters: {
      uid: (state) => { return state.firebaseUser.adminFirebaseUser?.uid },
      email: (state) => { return state.firebaseUser.adminFirebaseUser?.email },
      userType: (state) => { return state.roarfirekit.userData.userType },
      isUserAuthedAdmin: (state) => { return Boolean(state.firebaseUser.adminFirebaseUser) },
      isUserAuthedApp: (state) => { return Boolean(state.firebaseUser.appFirebaseUser) },
      isAuthenticated: (state) => { return (Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser)) },
      isFirekitInit: (state) => { return state.roarfirekit?.initialized },
      // User Information Getters
      adminClaims: (state) => { return state.roarfirekit?.adminClaims },
      assignedAssignments: (state) => { return state.roarfirekit.currentAssignments?.assigned },
      userData: (state) => { return state.roarfirekit?.userData }
    },
    actions: {
      async getAssignments(assignments) {
        try{
          const reply = await this.roarfirekit.getAssignments(assignments)
          this.firekitAssignments = reply
          this.firekitAssignmentIds = assignments;
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
            this.localFirekitInit = true
            this.firebaseUser.adminFirebaseUser = user;
          } else {
            this.firebaseUser.adminFirebaseUser = null;
          }
        })
        onAuthStateChanged(this.roarfirekit?.app.auth, async (user) => {
          if(user){
            this.firebaseUser.appFirebaseUser = user;
          } else {
            this.firebaseUser.appFirebaseUser = null;
          }
        })
      },
      async initFirekit() {
        this.roarfirekit = await initNewFirekit().then((firekit) => {
          return firekit
        });
      },
      async registerWithEmailAndPassword({ email, password, userData }) {
        console.log('calling register with', email, password, userData)
        return this.roarfirekit.createStudentWithEmailPassword(email, password, userData);
      },
      async logInWithEmailAndPassword({ email, password }) {
        if(this.isFirekitInit){
          return this.roarfirekit.logInWithEmailAndPassword({ email, password }).then(() => {
            if(this.roarfirekit.userData){
              this.hasUserData = true;
              this.firekitUserData = this.roarfirekit.userData;
            }
          })
        }
        
      },
      async signInWithGooglePopup() {
        console.log("triggered google popup")
        if(this.isFirekitInit){
          console.log("firekit is initialized")
          return this.roarfirekit.signInWithPopup('google').then(() => {
            if(this.roarfirekit.userData){
              this.hasUserData = true
              this.firekitUserData = this.roarfirekit.userData
            }
          })
        }
      },
      async signInWithCleverPopup() {
        console.log('triggered clever popup')
        if(this.isFirekitInit){
          console.log("firekit is initialized")
          return this.roarfirekit.signInWithPopup('clever').then(() => {
            console.log('log in with clever response:')
            if(this.roarfirekit.userData){
              this.hasUserData = true
              this.firekitUserData = this.roarfirekit.userData
            }
          })
        }
      },
      async signInWithGoogleRedirect() {
        return this.roarfirekit.initiateRedirect("google");
      },
      async signInWithCleverRedirect() {
        console.log('calling rfk redirect with clever')
        return this.roarfirekit.initiateRedirect("clever");
      },
      async initStateFromRedirect() {
        const enableCookiesCallback = () => {
          router.replace({ name: 'EnableCookies' });
        }
        if(this.isFirekitInit){
          return this.roarfirekit.signInFromRedirectResult(enableCookiesCallback).then(() => {
            if(this.roarfirekit.userData){
              this.hasUserData = true
              this.firekitUserData = this.roarfirekit.userData
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
