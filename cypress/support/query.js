import { collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getDevFirebase } from './devFirebase';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

async function getUserId(user, adminFirestore) {
  console.log('Grabbing userId for user', user);
  const adminUsersRef = collection(adminFirestore, 'users');
  const userQuery = await query(adminUsersRef, where('username', '==', user));
  const userSnapshot = await getDocs(userQuery);
  const userIds = userSnapshot.docs.map((doc) => doc.id);
  cy.log(user, userIds);
  return userIds[0]; // return the first user ID
}

async function resetAssignmentDoc(assignmentRef, assignmentData) {
  for (const assessment of assignmentData.assessments) {
    cy.log('Deleting assessment data for task', assessment.taskId);
    delete assessment.allRunIds;
    delete assessment.runId;
    delete assessment.startedOn;
    delete assessment.completedOn;
  }
  delete assignmentData.completed;
  delete assignmentData.started;
  await updateDoc(assignmentRef, assignmentData);
}

export async function signInAsSuperAdmin(firebaseAuth) {
  const auth = getAuth(firebaseAuth);
  await signInWithEmailAndPassword(auth, 'testsuperadmin1@roar-auth.com', '!roartestsuperadmin1');
}

export async function deleteTestRuns(user, adminFirestore, assessmentFirestore) {
  cy.then(async () => {
    const userId = await getUserId(user, adminFirestore);
    cy.log('Found user', user, 'with userId', userId);

    const runsCollectionRef = await collection(assessmentFirestore, 'users', userId, 'runs');
    const runsSnapshot = await getDocs(runsCollectionRef);
    cy.log('Found', runsSnapshot.size, 'runs for user', user);

    //   Loop through each run, get the assignmentId, and reset the assignment
    for (const run of runsSnapshot.docs) {
      const runData = run.data();
      const runDataId = run.id;

      const assignmentId = runData.assignmentId;
      const assignmentRef = await doc(adminFirestore, 'users', userId, 'assignments', assignmentId);
      const assignmentDoc = await getDoc(assignmentRef);
      const assignmentData = assignmentDoc.data();
      await resetAssignmentDoc(assignmentRef, assignmentData);
      await deleteDoc(doc(assessmentFirestore, 'users', userId, 'runs', runDataId));
    }
  });
}

export async function deleteTestAdmins(adminFirestore) {
  const administrationsRef = collection(adminFirestore, 'administrations');
  const q = query(administrationsRef, where('testData', '==', true));
  const querySnapshot = await getDocs(q);
  cy.log('Found', querySnapshot.size, 'test administrations.');

  const regexSuper = /^Cypress Super Admin Test Administration \d{10}$/;
  const regexPartner = /^Cypress Partner Admin Test Administration \d{10}$/;

  for (const doc of querySnapshot.docs) {
    const docData = doc.data();
    if (regexSuper.test(docData.name || regexPartner.test(docData.name))) {
      cy.wrap(deleteDoc(doc.ref)).then(() => {
        cy.log('Deleted test administration', doc.id, docData.name);
      });
    }
  }
}

export async function deleteTestOrgs(adminFirestore) {
  const orgs = ['districts', 'schools', 'classs', 'groups'];

  for (const org of orgs) {
    const orgsRef = collection(adminFirestore, org);
    const q = query(orgsRef, where('testData', '==', true));
    const querySnapshot = await getDocs(q);
    cy.log('Found', querySnapshot.size, 'test', org);

    const regex = /^Cypress Test (?:District|School|Class|Group) \d{10}$/;

    for (const doc of querySnapshot.docs) {
      const docData = doc.data();
      if (regex.test(docData.name)) {
        await deleteDoc(doc.ref);
      }
    }
  }
}

export async function deleteTestAdministrators(adminFirestore, assessmentFirestore) {
  const adminUsersRef = collection(adminFirestore, 'users');

  const q = query(adminUsersRef, where('userType', '==', 'admin'));
  const querySnapshot = await getDocs(q);
  const regex = /^Cypress Test Administrator First Name \d{10}$/;

  for (const docSnap of querySnapshot.docs) {
    const docData = docSnap.data();
    const userId = docSnap.id;
    if (docData.name && regex.test(docData.name.first)) {
      cy.log('Found test administrator', userId, docData?.name.first);

      const adminUserDocRef = doc(adminFirestore, 'users', userId);
      const adminUserClaimsRef = doc(adminFirestore, 'userClaims', userId);
      const assessmentUserDocRef = doc(assessmentFirestore, 'users', userId);
      const assessmentUserClaimsRef = doc(assessmentFirestore, 'userClaims', userId);

      const adminUserDoc = await getDoc(adminUserDocRef);
      const adminUserClaimsDoc = await getDoc(adminUserClaimsRef);
      const assessmentUserDoc = await getDoc(assessmentUserDocRef);
      const assessmentUserClaimsDoc = await getDoc(assessmentUserClaimsRef);

      await deleteDoc(adminUserDoc.ref);
      await deleteDoc(adminUserClaimsDoc.ref);
      await deleteDoc(assessmentUserDoc.ref);
      await deleteDoc(assessmentUserClaimsDoc.ref);
    }
  }
}

export const getOpenAdministrations = async (db) => {
  const auth = getDevFirebase('admin').auth;
  await signInAsSuperAdmin(auth);
  const currentTime = Timestamp.now();
  const admins = [];
  const administrationsRef = collection(db, 'administrations');
  const q = query(administrationsRef, where('dateClosed', '>=', currentTime));

  const querySnapshot = await getDocs(q);

  for (const snapShot of querySnapshot.docs) {
    admins.push(snapShot.data().name);
  }

  return admins;
};
