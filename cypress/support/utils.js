export const randomizeName = (orgName) => {
  return `${orgName}` + ' ' + `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};
