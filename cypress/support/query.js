import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDevFirebase } from './devFirebase';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import _chunk from 'lodash/chunk';

async function getUserId(user, adminFirestore) {
  console.log('Grabbing userId for user', user);
  const adminUsersRef = collection(adminFirestore, 'users');
  const userQuery = await query(adminUsersRef, where('username', '==', user));
  const userSnapshot = await getDocs(userQuery);
  const userIds = userSnapshot.docs.map((doc) => doc.id);
  cy.log(user, userIds);
  return userIds[0]; // return the first user ID
}
export async function deleteCollectionDocs(db, path) {
  const collectionRef = collection(db, path);
  const snapshot = await getDocs(collectionRef);

  if (snapshot.empty) {
    return;
  }

  const batchSize = 500;
  const documentsToDelete = snapshot.docs;
  const chunks = _chunk(documentsToDelete, batchSize);

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
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
  // Allow 3 hours for this operation to complete
  cy.then({ timeout: 10_800_000 }, async () => {
    await getUserId(user, adminFirestore).then(async (id) => {
      const runsCollectionRef = collection(assessmentFirestore, 'users', id, 'runs');
      await getDocs(runsCollectionRef).then(async (runsSnapshot) => {
        console.log('Found', runsSnapshot.size, 'runs for user', user);

        const seenAssignmentIds = new Set();

        //   Loop through each run, get the assignmentId, and reset the assignment
        for (const run of runsSnapshot.docs) {
          const runData = run.data();
          const runId = run.id;

          const assignmentId = runData.assignmentId;
          // Check if the assignmentId has already been seen in order to preserve a single run per assignment
          // This will allow CI tests based on score reports to continue to pass
          if (seenAssignmentIds.has(assignmentId)) {
            const assignmentRef = doc(adminFirestore, 'users', id, 'assignments', assignmentId);
            await getDoc(assignmentRef).then(async (assignmentDoc) => {
              if (!assignmentDoc.exists()) {
                console.log('Assignment document does not exist');
                return;
              }
              const assignmentData = assignmentDoc.data();
              console.log(`Resetting assignment doc: users/${id}/assignments/${assignmentId}`);
              await resetAssignmentDoc(assignmentRef, assignmentData)
                .then(async () => {
                  console.log(`Deleting trials: users/${id}/runs/${runId}/trials`);
                  await deleteCollectionDocs(assessmentFirestore, `users/${id}/runs/${runId}/trials`);
                })
                .then(async () => {
                  console.log(`Deleting run: users/${id}/runs/${runId}`);
                  await deleteDoc(doc(assessmentFirestore, 'users', id, 'runs', runId));
                });
            });
          } else {
            seenAssignmentIds.add(assignmentId);
          }
        }
      });
    });
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
