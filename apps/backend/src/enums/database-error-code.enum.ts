/**
 * Enum containing error codes related to database operations.
 */
export enum DatabaseErrorCode {
  /** Error code for when a query fails. */
  QUERY_FAILED = 'database_query_failed',

  /** Error code for when a document is not found. */
  NOT_FOUND = 'database_document_not_found',

  /** Error code for when documents conflict with each other. */
  CONFLICT = 'database_documents_conflict',

  /** Error code for when invalid parameters are provided. */
  INVALID_PARAMS = 'database_invalid_params',
}
