/* eslint-disable no-console */
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getRegisteredVariants(firestore, task) {
  try {
    const variantsRef = collection(firestore, 'tasks', task, 'variants');
    const q = query(variantsRef, where('registered', '==', true));
    const variantsSnapshot = await getDocs(q);

    if (variantsSnapshot.empty) {
      console.log('No registered variants found.');
      return [];
    }
    const docs = [];
    console.log(`Found ${variantsSnapshot.size} registered variants.`);
    variantsSnapshot.forEach((doc) => {
      docs.push(doc.data());
    });
    return docs;
  } catch (error) {
    console.log('Error getting documents:', error);
    return [];
  }
}
