import axios from 'axios';

export const randomizeName = (orgName) => {
  return `${orgName}` + ' ' + `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};

export const isCurrentVersion = async (app) => {
  // This function checks if the feature package.json version is the same as the main package.json version
  // It returns a true or false value based on the comparison
  const featurePackageJson = require('../../package.json');
  const featureDependencies = featurePackageJson.dependencies;

  const owner = 'yeatmanlab'; // Your GitHub username
  const repository = 'roar-dashboard'; // Your repository name
  const filePath = 'package.json'; // Path to the file in the repository
  const branch = 'main'; // Branch to fetch from

  const url = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;

  const response = await axios.get(url);

  const mainPackageJson = JSON.parse(atob(response.data.content), 'utf-8');
  const mainDependencies = mainPackageJson.dependencies;

  // Slice the carat ^ from the version number
  const mainAppVersion = mainDependencies[app].slice(1);
  const currentAppVersion = featureDependencies[app].slice(1);
  console.log('main', mainAppVersion);
  console.log('feature', currentAppVersion);

  return mainAppVersion === currentAppVersion;
};
