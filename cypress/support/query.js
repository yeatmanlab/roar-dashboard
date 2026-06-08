import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getRegisteredVariants(firestore, task) {
  try {
    const variantsRef = collection(firestore, 'tasks', task, 'variants');
    const q = query(variantsRef, where('registered', '==', true));
    const variantsSnapshot = await getDocs(q);

    if (variantsSnapshot.empty) {
      // eslint-disable-next-line no-console
      console.log('No registered variants found.');
      return [];
    }
    const docs = [];
    // eslint-disable-next-line no-console
    console.log(`Found ${variantsSnapshot.size} registered variants.`);
    variantsSnapshot.forEach((doc) => {
      docs.push(doc.data());
    });
    return docs;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Error getting documents:', error);
    return [];
  }
}
