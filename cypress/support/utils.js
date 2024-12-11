import axios from 'axios';
import { useAuthStore } from '../../src/store/auth.js';
import featurePackageJson from '../../package.json';

/**
 * Generates a randomized name by appending a random 10-digit number to the provided organization name.
 *
 * @param {string} orgName - The base name of the organization.
 * @returns {string} - The randomized name.
 */
export const randomizeName = (orgName) => {
  return `${orgName}` + ' ' + `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};

/**
 * Checks if the specified app's version in the feature branch matches the version in the main branch.
 *
 * @param {string} app - The name of the app to check the version for.
 * @returns {Promise<boolean>} - Returns true if the app version matches the main branch version, otherwise false.
 */
export const isCurrentVersion = async (app) => {
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
