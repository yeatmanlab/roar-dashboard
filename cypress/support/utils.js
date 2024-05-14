import axios from 'axios';

export const randomizeName = (orgName) => {
  return `${orgName}` + ' ' + `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};

export const isCurrentVersion = async (app) => {
  // This function checks if the feature package.json version is the same as the main package.json version
  // It returns a true or false value based on the comparison
  const featurePackageJson = require('../../package.json');
  const featureDependencies = featurePackageJson.dependencies;

  const owner = 'yeatmanlab';
  const repository = 'roar-dashboard';
  const filePath = 'package.json';
  const branch = 'main';

  const url = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;

  try {
    const response = await axios.get(url);
    const mainPackageJson = JSON.parse(window.atob(response.data.content), 'utf-8');
    const mainDependencies = mainPackageJson.dependencies;

    const mainAppVersion = mainDependencies[app];
    const currentAppVersion = featureDependencies[app];

    return mainAppVersion === currentAppVersion;
  } catch (error) {
    console.error(`Failed to check if ${app} is the current version: ${error}`);
    return false;
  }
};
