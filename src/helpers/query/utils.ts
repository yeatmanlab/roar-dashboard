import { toValue } from 'vue';
import type { Ref } from 'vue';
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import Papa from 'papaparse';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _fromPairs from 'lodash/fromPairs';
import _last from 'lodash/last';
import _mapValues from 'lodash/mapValues';
import _toPairs from 'lodash/toPairs';
import _union from 'lodash/union';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { FIRESTORE_DATABASES } from '@/constants/firebase';

// --- Interfaces & Types ---

// More robust Firestore value types
interface FirestoreNullValue { nullValue: null }
interface FirestoreBooleanValue { booleanValue: boolean }
interface FirestoreTimestampValue { timestampValue: string }
interface FirestoreStringValue { stringValue: string }
interface FirestoreBytesValue { bytesValue: string }
interface FirestoreReferenceValue { referenceValue: string }
interface FirestoreGeoPointValue { geoPointValue: { latitude: number; longitude: number } }
interface FirestoreIntegerValue { integerValue: string }
interface FirestoreDoubleValue { doubleValue: string }
interface FirestoreArrayValue { arrayValue: { values?: FirestoreValue[] } }
interface FirestoreMapValue { mapValue: { fields: Record<string, FirestoreValue> } }

type FirestoreValue = 
    | FirestoreNullValue
    | FirestoreBooleanValue
    | FirestoreTimestampValue
    | FirestoreStringValue
    | FirestoreBytesValue
    | FirestoreReferenceValue
    | FirestoreGeoPointValue
    | FirestoreIntegerValue
    | FirestoreDoubleValue
    | FirestoreArrayValue
    | FirestoreMapValue;

// Type for a Firestore document field map
type FirestoreFields = Record<string, FirestoreValue>;

// Type for a raw document from Firestore REST API
interface FirestoreDocumentRaw {
  name?: string; // e.g., projects/projectId/databases/(default)/documents/collection/docId
  fields?: FirestoreFields;
  createTime?: string;
  updateTime?: string;
}

// Type for the structured query API response item
interface FirestoreQueryResponseItem {
    document?: FirestoreDocumentRaw;
    readTime?: string;
    transaction?: string;
}

// Type for a processed document after conversion
interface ProcessedDocument {
    id: string;
    collection?: string; // Make collection optional or handle consistently
    [key: string]: any; 
}

// Type for fetchDocsById input
interface DocumentToFetch {
    collection: string;
    docId: string;
    select?: string[];
}

// Type for batchGet response item
interface BatchGetResponseItem {
    found?: FirestoreDocumentRaw;
    missing?: string;
    transaction?: string;
    readTime?: string;
}

// Type for orderBy clause
interface OrderBy {
    field: { fieldPath: string };
    direction: 'ASCENDING' | 'DESCENDING';
}

// --- Value Conversion ---

/**
 * Converts Firestore REST API value types to plain JavaScript types.
 * @param value - The FirestoreValue object.
 * @returns The converted JavaScript value.
 */
export function convertValues(value: FirestoreValue | undefined): any {
  if (!value) return undefined;

  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue; // Consider new Date(value.timestampValue)
  if ('nullValue' in value) return null;
  if ('bytesValue' in value) return value.bytesValue; // Or handle as needed (e.g., base64 decode)
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  
  if ('arrayValue' in value) {
    return value.arrayValue?.values?.map(convertValues) ?? [];
  }
  
  if ('mapValue' in value) {
    return _mapValues(value.mapValue.fields ?? {}, convertValues);
  }

  console.warn('Unhandled Firestore value type:', value);
  return undefined;
}

/**
 * Maps Firestore document fields to a simpler object structure, including the document ID.
 * @param data - Array of Firestore query response items.
 * @param getParentDocId - Whether to extract the parent document ID.
 * @returns Array of processed documents.
 */
export function mapFields(
    data: FirestoreQueryResponseItem[], 
    getParentDocId?: boolean
): ProcessedDocument[] {
  const fieldsArray = data
    .map((item) => {
      if (item.document?.fields && item.document.name) {
        const nameSplit = item.document.name.split('/');
        const id = _last(nameSplit) ?? ''; // Provide default empty string
        const parentDoc = getParentDocId ? nameSplit[nameSplit.length - 3] : undefined;
        
        const processedFields: Record<string, any> = _mapValues(
            item.document.fields, 
            convertValues
        );
        
        processedFields.id = id;
        if (parentDoc) {
          processedFields.parentDoc = parentDoc;
        }
        return processedFields;
      }
      return undefined;
    })
    .filter((item): item is Record<string, any> => item !== undefined); // Type guard

  return fieldsArray as ProcessedDocument[]; // Assert type after filtering
}

// --- Constants ---

export const orderByDefault: OrderBy[] = [
  {
    field: { fieldPath: 'name' },
    direction: 'ASCENDING',
  },
];

// --- Axios & Project ID ---

/**
 * Gets the Firebase Project ID for a specific project context.
 * @param project - The project context (default: 'admin').
 * @returns The Project ID or undefined.
 */
export function getProjectId(project: string = 'admin'): string | undefined {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore) as { roarfirekit: Ref<any> }; // Use 'any' if roarfirekit type is complex
  return roarfirekit.value?.roarConfig?.[project]?.projectId;
}

/**
 * Creates an Axios instance configured for Firestore REST API calls.
 * @param db - The Firestore database identifier.
 * @param unauthenticated - Whether the request should be unauthenticated.
 * @returns Configured Axios instance.
 * @throws Error if the baseURL is not set in the config.
 */
export function getAxiosInstance(db: string = FIRESTORE_DATABASES.ADMIN, unauthenticated: boolean = false): AxiosInstance {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore) as { roarfirekit: Ref<any> };
  const baseConfig: InternalAxiosRequestConfig = _get(roarfirekit.value?.restConfig, db, {}); 

  // Create a new config object to avoid modifying the original store ref
  const axiosOptions: InternalAxiosRequestConfig = { ...baseConfig }; 

  if (unauthenticated && axiosOptions.headers) {
    // Create a new headers object excluding Authorization
    const currentHeaders = axiosOptions.headers as Record<string, any>; 
    const newHeaders: Record<string, any> = {};
    for (const key in currentHeaders) {
        if (key.toLowerCase() !== 'authorization') {
            newHeaders[key] = currentHeaders[key];
        }
    }
    // Use type assertion as the structure is compatible but type is complex
    axiosOptions.headers = newHeaders as any; 
  }

  if (!axiosOptions.baseURL) {
    console.error(`Axios baseURL not configured for database: ${db}`);
    throw new Error(`Base URL is not set for database: ${db}.`);
  }

  return axios.create(axiosOptions);
}

// --- CSV Export ---

/**
 * Exports data as a CSV file.
 * @param data - Array of objects to export.
 * @param filename - The desired name for the CSV file.
 */
export function exportCsv(data: Record<string, any>[], filename: string): void {
  if (!data || data.length === 0) {
      console.warn('exportCsv: No data provided to export.');
      return;
  }
  // TODO: Replace with actual flattenObj import/implementation
  const flattenObjPlaceholder = (item: Record<string, any>): Record<string, any> => item; 
  const csvData = data.map(flattenObjPlaceholder); 
  const csvColumns = _union(...csvData.map(Object.keys));
  
  try {
      const csv = Papa.unparse(csvData, { columns: csvColumns });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); // Specify charset
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href); // Clean up object URL
  } catch (error) {
      console.error('Error generating or downloading CSV:', error);
      // Optionally inform the user
  }
}

// --- Firestore Fetch Helpers ---

/**
 * Fetches a single Firestore document by its ID using the REST API.
 * @param collection - The Firestore collection name.
 * @param docId - The ID of the document to fetch.
 * @param select - Optional array of field paths to select.
 * @param db - The Firestore database identifier.
 * @param unauthenticated - Whether the request should be unauthenticated.
 * @returns A promise resolving to the processed document data or an empty object on error/not found.
 */
export async function fetchDocById(
  collection: string | Ref<string>,
  docId: string | Ref<string>,
  select?: string[],
  db: string = FIRESTORE_DATABASES.ADMIN,
  unauthenticated: boolean = false,
): Promise<ProcessedDocument | {}> { // Return empty object on failure for consistency?
  const collectionValue = toValue(collection);
  const docIdValue = toValue(docId);

  if (!collectionValue || !docIdValue) {
    console.warn(
      `fetchDocById: Collection or docId not provided. Called with collection "${collectionValue}" and docId "${docIdValue}"`,
    );
    return {};
  }

  const docPath = `/${collectionValue}/${docIdValue}`;
  try {
      const axiosInstance = getAxiosInstance(db, unauthenticated);
      const queryParams = (select ?? []).map((field) => `mask.fieldPaths=${field}`);
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      
      const response: AxiosResponse<{ fields?: FirestoreFields }> = await axiosInstance.get(docPath + queryString);
      
      if (!response.data || !response.data.fields) {
          console.warn(`fetchDocById: Document not found or has no fields: ${docPath}`);
          return {}; // Return empty object if doc not found or has no fields
      }

      return {
          id: docIdValue,
          collection: collectionValue, // Keep original collection name
          ..._mapValues(response.data.fields, convertValues),
      } as ProcessedDocument;
  } catch (error) {
      const axiosError = error as AxiosError; // Type assertion
      console.error(`fetchDocById: Error fetching document ${docPath}:`, axiosError.message);
      if (axiosError.response?.status === 404) {
          console.warn(`fetchDocById: Document not found: ${docPath}`);
      }
      return {}; // Return empty object on error
  }
}

/**
 * Fetches multiple Firestore documents by their IDs using the batchGet method.
 * @param collection - The Firestore collection name.
 * @param docIds - Array of document IDs to fetch.
 * @param select - Optional array of field paths to select.
 * @param db - The Firestore database identifier.
 * @returns A promise resolving to an array of processed document data.
 */
export async function fetchDocumentsById(
    collection: string,
    docIds: string[] | Ref<string[]>, 
    select: string[] = [], 
    db: string = FIRESTORE_DATABASES.ADMIN
): Promise<ProcessedDocument[]> {
  const docIdsValue = toValue(docIds);
  if (!collection || !docIdsValue || docIdsValue.length === 0) {
      console.warn('fetchDocumentsById: Collection or docIds not provided or empty.');
      return [];
  }

  try {
      const axiosInstance = getAxiosInstance(db);
      // Extract base path correctly, handle potential trailing slash
      const baseUrlParts = axiosInstance.defaults.baseURL?.split('googleapis.com/v1/');
      if (!baseUrlParts || baseUrlParts.length < 2) {
          throw new Error('Could not determine Firestore base path from Axios config.');
      }
      const basePath = baseUrlParts[1].replace(/\/$/, ''); // Remove trailing slash if exists
      
      const documents = docIdsValue.map((docId) => `${basePath}/${collection}/${docId}`);

      const requestBody: { documents: string[]; mask?: { fieldPaths: string[] } } = {
          documents,
      };

      if (select?.length > 0) {
          requestBody.mask = { fieldPaths: select };
      }

      const response: AxiosResponse<BatchGetResponseItem[]> = await axiosInstance.post(':batchGet', requestBody);
      
      return response.data
          .filter((item): item is { found: FirestoreDocumentRaw } => !!item.found && !!item.found.name)
          .map(({ found }) => {
              const pathParts = found!.name!.split('/'); // Assert non-null with !
              const documentId = pathParts.pop() ?? '';
              const collectionName = pathParts.pop() ?? '';
              return {
                  id: documentId,
                  collection: collectionName,
                  ..._mapValues(found!.fields ?? {}, convertValues), // Handle potentially undefined fields
              } as ProcessedDocument;
          });
  } catch (error) {
      const axiosError = error as AxiosError;
      console.error('fetchDocumentsById: Error fetching documents:', axiosError.message);
      return [];
  }
}

/**
 * @deprecated Use fetchDocumentsById instead for efficiency.
 * Fetches multiple Firestore documents by making individual requests.
 */
export async function fetchDocsById(
    documents: DocumentToFetch[], 
    db: string = FIRESTORE_DATABASES.ADMIN
): Promise<ProcessedDocument[]> {
  if (_isEmpty(documents)) {
    console.warn('fetchDocsById (deprecated): No documents provided!');
    return [];
  }

  console.warn('fetchDocsById is deprecated. Use fetchDocumentsById for better performance.');

  const promises = documents.map(({ collection, docId, select }) => 
      fetchDocById(collection, docId, select, db)
  );
  
  // Filter out empty objects resulting from errors in individual fetchDocById calls
  const results = (await Promise.all(promises)).filter(doc => !_isEmpty(doc)); 
  return results as ProcessedDocument[]; // Assert type after filtering
}

/**
 * Fetches multiple Firestore documents using batchGet based on full document paths.
 * @param docPaths - Array of full document paths.
 * @param select - Optional array of field paths to select.
 * @param db - The Firestore database identifier.
 * @returns A promise resolving to an array of processed document data, maintaining original order.
 */
export async function batchGetDocs(
    docPaths: string[], 
    select: string[] = [], 
    db: string = FIRESTORE_DATABASES.ADMIN
): Promise<(ProcessedDocument | undefined)[]> { // Return undefined for missing docs
  if (_isEmpty(docPaths)) {
    return [];
  }

  try {
      const axiosInstance = getAxiosInstance(db);
      const baseUrlParts = axiosInstance.defaults.baseURL?.split('googleapis.com/v1/');
       if (!baseUrlParts || baseUrlParts.length < 2) {
          throw new Error('Could not determine Firestore base path from Axios config.');
      }
      const basePath = baseUrlParts[1].replace(/\/$/, '');
      
      const documents = docPaths.map((docPath) => `${basePath}/${docPath}`);

      const requestBody: { documents: string[]; mask?: { fieldPaths: string[] } } = {
          documents,
      };
      if (select.length > 0) {
          requestBody.mask = { fieldPaths: select };
      }

      const response: AxiosResponse<BatchGetResponseItem[]> = await axiosInstance.post(':batchGet', requestBody);

      const resultMap = new Map<string, ProcessedDocument>();
      response.data.forEach(item => {
          if (item.found && item.found.name && item.found.fields) {
              const nameSplit = item.found.name.split('/');
              const docId = nameSplit.pop() ?? '';
              const collection = nameSplit.pop() ?? '';
              resultMap.set(item.found.name, {
                  id: docId,
                  collection: collection,
                  ..._mapValues(item.found.fields, convertValues),
              } as ProcessedDocument);
          }
      });

      // Map results back to original order, placing undefined for missing docs
      return docPaths.map(docPath => resultMap.get(`${basePath}/${docPath}`));

  } catch (error) {
      const axiosError = error as AxiosError;
      console.error('batchGetDocs: Error fetching documents:', axiosError.message);
      // Return array of undefined matching the input length on error?
      return docPaths.map(() => undefined); 
  }
}

// --- Misc ---

// Consider using a more specific type if possible
export const matchMode2Op: Record<string, string> = {
  equals: 'EQUAL',
  notEquals: 'NOT_EQUAL',
};

/**
 * Fetches all documents from a Firestore subcollection.
 * @param collectionPath - The path to the parent document (e.g., 'collection/docId').
 * @param subcollectionName - The name of the subcollection.
 * @param select - Optional array of field paths to select.
 * @param db - The Firestore database identifier.
 * @returns A promise resolving to an array of processed subcollection documents or an error object.
 */
export async function fetchSubcollection(
  collectionPath: string,
  subcollectionName: string,
  select: string[] = [],
  db: string = FIRESTORE_DATABASES.ADMIN,
): Promise<ProcessedDocument[] | { error: string }> { // Return type indicates possible error
  const axiosInstance = getAxiosInstance(db);
  const subcollectionPath = `/${collectionPath}/${subcollectionName}`;
  const queryParams = select.map((field) => `mask.fieldPaths=${field}`).join('&');
  const queryString = queryParams ? `?${queryParams}` : '';

  try {
    const response: AxiosResponse<{ documents?: FirestoreDocumentRaw[] }> = 
        await axiosInstance.get(subcollectionPath + queryString);

    const documents = response.data.documents ?? [];

    return documents.map((doc) => {
      if (!doc.name || !doc.fields) {
          // Should not happen if API response is valid, but good to check
          console.warn('fetchSubcollection: Received invalid document structure', doc);
          // Return a placeholder or filter it out? Depends on desired behavior.
          return { id: 'error', collection: subcollectionName }; // Placeholder
      }
      return {
          id: doc.name.split('/').pop() ?? '', 
          collection: subcollectionName, // Subcollection name
          ..._mapValues(doc.fields, convertValues),
      }
    }) as ProcessedDocument[]; // Assert type after potential placeholders are handled/filtered
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`Failed to fetch subcollection ${subcollectionPath}: `, axiosError.message);
    return {
      error: axiosError.response?.status === 404 ? 'Subcollection not found' : axiosError.message || 'Unknown error',
    };
  }
} 