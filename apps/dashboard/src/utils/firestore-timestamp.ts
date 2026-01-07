interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface FirestoreServerTimestamp {
  timestampValue: string;
}

/**
 * Converts a Firestore timestamp object to a JavaScript Date
 * @param timestamp Firestore timestamp object (either client-side or server-side format)
 * @returns JavaScript Date object
 */
export function firestoreTimestampToDate(timestamp: FirestoreTimestamp | FirestoreServerTimestamp | Date): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // Handle server-side timestamp format (from REST API)
  if ('timestampValue' in timestamp) {
    return new Date(timestamp.timestampValue);
  }

  // Handle client-side timestamp format (from Firestore SDK)
  if ('_seconds' in timestamp && '_nanoseconds' in timestamp) {
    const milliseconds = timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000;
    return new Date(milliseconds);
  }

  return new Date();
}

/**
 * Recursively converts all Firestore timestamps in an object to JavaScript Dates
 * @param obj Object that may contain Firestore timestamps
 * @returns Object with all timestamps converted to Dates
 */
export function convertFirestoreTimestamps<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  // Check if object is a Firestore timestamp (either format)
  if (('_seconds' in obj && '_nanoseconds' in obj) || 'timestampValue' in obj) {
    return firestoreTimestampToDate(obj as FirestoreTimestamp | FirestoreServerTimestamp) as unknown as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => convertFirestoreTimestamps(item)) as unknown as T;
  }

  // Handle objects recursively
  const converted = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    converted[key as keyof T] = convertFirestoreTimestamps(value);
  }

  return converted;
}
