import { collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';

async function getUserId(user, adminFirestore) {
  console.log('Grabbing userId for user', user);
  const adminUsersRef = collection(adminFirestore, 'users');
  const userQuery = await query(adminUsersRef, where('username', '==', user));
  const userSnapshot = await getDocs(userQuery);
  const userIds = userSnapshot.docs.map((doc) => doc.id);
  return userIds[0];
}

async function resetAssignmentDoc(assignmentRef, assignmentData) {
  for (const assessment of assignmentData.assessments) {
    console.log('Deleting assessment data for task', assessment.taskId);
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
    console.log('Found user', user, 'with userId', userId);

    const runsCollectionRef = await collection(assessmentFirestore, 'users', userId, 'runs');
    const runsSnapshot = await getDocs(runsCollectionRef);
    console.log('Found', runsSnapshot.size, 'runs for user', user);

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

export async function deleteTestAdministrations(adminFirestore) {
  const administrationsRef = collection(adminFirestore, 'administrations');
  const q = query(administrationsRef, where('testData', '==', true));
  const querySnapshot = await getDocs(q);
  console.log('Found', querySnapshot.size, 'test administrations.');

  const regexSuper = /^Cypress Super Admin Test Administration \d{10}$/;
  const regexPartner = /^Cypress Partner Admin Test Administration \d{10}$/;

  for (const doc of querySnapshot.docs) {
    const docData = doc.data();
    if (regexSuper.test(docData.name || regexPartner.test(docData.name))) {
      console.log('Deleting test administration', doc.id, docData.name);
      await deleteDoc(doc.ref);
    }
  }
}

export async function deleteTestOrgs(adminFirestore) {
  const orgs = ['districts', 'schools', 'classes', 'groups'];

  for (const org of orgs) {
    console.log('Checking for test', org);
    const orgsRef = collection(adminFirestore, org);
    const q = query(orgsRef, where('testData', '==', true));
    const querySnapshot = await getDocs(q);
    console.log('Found', querySnapshot.size, 'test', org);

    const regex = /^Cypress Test (?:District|School|Class|Group) \d{10}$/;

    for (const doc of querySnapshot.docs) {
      const docData = doc.data();

      if (regex.test(docData.name)) {
        console.log('Deleting test org', doc.id, docData.name);
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
      console.log('Deleting test administrator', userId, docData?.name.first);

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
