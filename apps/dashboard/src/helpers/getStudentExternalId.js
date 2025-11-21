export const getStudentExternalId = (studentData) => {
  if (!studentData || typeof studentData !== 'object') return '';

  if (studentData.sisId != null) return `_sisId-${studentData.sisId}`;
  if (studentData.studentId != null) return `_studentId-${studentData.studentId}`;
  if (studentData.stateId != null) return `_stateId-${studentData.stateId}`;

  return '';
};
