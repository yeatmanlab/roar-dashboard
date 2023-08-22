import { defineStore } from "pinia";
import { onAuthStateChanged } from "firebase/auth";
import { initNewFirekit } from "../firebaseInit";

import _get from "lodash/get";
import _set from "lodash/set";

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
        adminOrgs: null,
        roarfirekit: null,
        hasUserData: false,
        firekitUserData: null,
        firekitAssignments: {
          assigned: null
        },
        firekitAssignmentIds: null,
        firekitIsAdmin: false,
        firekitIsSuperAdmin: false,
        cleverOAuthRequested: false,
        emailForSignInLink: null,
      };
    },
    getters: {
      uid: (state) => { return state.firebaseUser.adminFirebaseUser?.uid },
      email: (state) => { return state.firebaseUser.adminFirebaseUser?.email },
      isUserAuthedAdmin: (state) => { return Boolean(state.firebaseUser.adminFirebaseUser) },
      isUserAuthedApp: (state) => { return Boolean(state.firebaseUser.appFirebaseUser) },
      isAuthenticated: (state) => { return (Boolean(state.firebaseUser.adminFirebaseUser) && Boolean(state.firebaseUser.appFirebaseUser)) },
      isFirekitInit: (state) => { return state.roarfirekit?.initialized },
    },
    actions: {
      isUserAdmin() {
        if(this.isFirekitInit) {
          this.firekitIsAdmin = this.roarfirekit.isAdmin();
        }
        return this.firekitIsAdmin;
      },
      isUserSuperAdmin() {
        if(this.isFirekitInit) {
          this.firekitIsSuperAdmin = _get(this.roarfirekit, '_superAdmin');
        }
        return this.firekitIsSuperAdmin;
      },
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
      async getLegalDoc(docName) {
        return await this.roarfirekit.getLegalDoc(docName);
      },
      async updateConsentStatus(docName, consentVersion) {
        _set(this.firekitUserData, `legal.${docName}.${consentVersion}`, new Date())
        this.roarfirekit.updateConsentStatus(docName, consentVersion);
      },
      async registerWithEmailAndPassword({ email, password, userData }) {
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
      async initiateLoginWithEmailLink({ email }) {
        if (this.isFirekitInit) {
          const redirectUrl = `${window.location.origin}/auth-email-link`;
          return this.roarfirekit.initiateLoginWithEmailLink({ email, redirectUrl }).then(() => {
            window.localStorage.setItem('emailForSignIn', email);
          });
        }
      },
      async signInWithEmailLink({ email, emailLink }) {
        if (this.isFirekitInit) {
          return this.roarfirekit.signInWithEmailLink({ email, emailLink }).then(() => {
            if(this.roarfirekit.userData){
              this.hasUserData = true
              this.firekitUserData = this.roarfirekit.userData
            }
            window.localStorage.removeItem('emailForSignIn');
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
      async signInWithCleverPopup() {
        if(this.isFirekitInit){
          return this.roarfirekit.signInWithPopup('clever').then(() => {
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
            this.adminOrgs = null;
            this.hasUserData = false;
            console.log('setting firekitIsAdmin to false')
            this.firekitIsAdmin = false;
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
      debug: false,
      afterRestore: async (ctx) => {
        if (ctx.store.roarfirekit) {
          ctx.store.roarfirekit = await initNewFirekit();
        }
      }
    },
  })();
};
