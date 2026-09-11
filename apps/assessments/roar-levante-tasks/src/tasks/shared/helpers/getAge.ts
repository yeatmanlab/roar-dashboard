export function getAge(birthMonth: number, birthYear: number) {
  const today = new Date();

  const years = today.getFullYear() - birthYear;
  const months = today.getMonth() + 1 - birthMonth;

  const ageInMonths = 12 * years + months;
  const age = Math.floor(ageInMonths / 12);

  return age;
}
