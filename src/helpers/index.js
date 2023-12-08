import { query, where, getDocs } from 'firebase/firestore';
import _fromPairs from 'lodash/fromPairs';
import _invert from 'lodash/invert';
import _toPairs from 'lodash/toPairs';
import * as Papa from 'papaparse';

export const isMobileBrowser = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  if (
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
      userAgent,
    ) ||
    /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
      userAgent.substr(0, 4),
    )
  )
    return true;

  return false;
};

export const getDocsFromQuery = async (collection, field, value) => {
  const q = query(collection, where(field, '==', value));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  } else if (querySnapshot.size == 1) {
    return querySnapshot.docs[0].data();
  } else {
    return querySnapshot.docs.map((doc) => doc.data());
  }
};

/**
 * Find an object in an array of objects by specifying its ID.
 * @param {Array} resources - Array of resource objects
 * @param {String} id - Resource ID
 * @returns
 */
export const findById = (resources, id) => {
  if (!resources) return null;
  return resources.find((r) => r.id === id);
};

/**
 * Upsert resource object into a resource array.
 * Upsert is a portmanteau of update/insert.  So if `resource` already exists in
 * `resources`, update it. Otherwise, insert it.
 * @param {Array} resources - Array of existing resource objects
 * @param {Object} resource - New object to either update or insert
 */
export const upsert = (resources, resource) => {
  const index = resources.findIndex((r) => r.id === resource.id);
  if (resource.id && index !== -1) {
    resources[index] = resource;
  } else {
    resources.push(resource);
  }
};

export const arrayRandom = (array) => {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

export const getUniquePropsFromUsers = (users, prop) => {
  const propArrays = users.map((user) => user[prop]).flat();
  return [...new Set(propArrays)].map((item) => ({ id: item }));
};

export const userHasSelectedOrgs = (userArray, selections) => {
  // If the selected org list is empty, return all users
  if (selections.length === 0) {
    return true;
  }
  const selectionArray = selections.map((item) => item.id);
  return Boolean(userArray.filter((value) => selectionArray.includes(value)).length);
};

export const formatDate = (date) => date?.toLocaleString('en-US');

const camelCase = (string) => string.replace(/_([a-z])/g, (groups) => groups[1].toUpperCase());

export const flattenObj = (obj) => {
  const result = {};

  for (const i in obj) {
    // We check the type of the i using
    // typeof() function and recursively
    // call the function again
    if (typeof obj[i] === 'object' && !Array.isArray(obj[i]) && obj[i] !== null) {
      const temp = flattenObj(obj[i]);
      for (const j in temp) {
        result[camelCase(i + '.' + j)] = temp[j] || '';
      }
    } else {
      result[i] = obj[i] || obj[i] === 0 ? obj[i] : '';
    }
  }
  return result;
};

export const csvFileToJson = (fileObject) =>
  new Promise((resolve, reject) => {
    Papa.parse(fileObject, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      transform: (value) => value.trim(),
      transformHeader: (value) => value.trim(),
      complete: function (results) {
        if (results.errors.length !== 0) {
          reject(results.errors);
        }
        resolve(results.data);
      },
    });
  });

export const standardDeviation = (arr, usePopulation = false) => {
  // prevent divide by 0
  if (arr.length === 0) return Infinity;

  const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
  return Math.sqrt(
    arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
      (arr.length - (usePopulation ? 0 : 1)),
  );
};

export const filterAdminOrgs = (adminOrgs, filters) => {
  const filteredOrgPairs = _toPairs(adminOrgs).map(([orgType, orgs]) => [
    orgType,
    orgs.filter((org) => filters[orgType]?.includes(org)),
  ]);

  return _fromPairs(filteredOrgPairs);
};

export const removeEmptyOrgs = (orgs) => {
  // eslint-disable-next-line no-unused-vars
  return _fromPairs(_toPairs(orgs).filter(([orgType, orgs]) => orgs.length > 0));
};

const plurals = {
  group: 'groups',
  district: 'districts',
  school: 'schools',
  class: 'classes',
  family: 'families',
  administration: 'administrations',
  user: 'users',
  assignment: 'assignments',
  run: 'runs',
  trial: 'trials',
};

export const pluralizeFirestoreCollection = (singular) => {
  if (Object.values(plurals).includes(singular)) return singular;

  const plural = plurals[singular];
  if (plural) return plural;

  throw new Error(`There is no plural Firestore collection for the ${singular}`);
};

export const singularizeFirestoreCollection = (plural) => {
  if (Object.values(_invert(plurals)).includes(plural)) return plural;

  const singular = _invert(plurals)[plural];
  if (singular) return singular;

  throw new Error(`There is no Firestore collection ${plural}`);
};
