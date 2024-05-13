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

export async function signInAsSuperAdmin(firebaseAuth) {
  const auth = getAuth(firebaseAuth);
  await signInWithEmailAndPassword(auth, 'testsuperadmin1@roar-auth.com', '!roartestsuperadmin1');
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
