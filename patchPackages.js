import fs from 'node:fs';
import path from 'node:path';

const NODE_MODULES_PATH = 'node_modules';
const PATCH_PATH = 'patches';

const replaceFile = (filePathList) => {
  try {
    const data = fs.readFileSync(path.resolve(path.dirname('package.json'), PATCH_PATH, ...filePathList), 'utf8');
    fs.writeFileSync(path.resolve(path.dirname('package.json'), NODE_MODULES_PATH, ...filePathList), data, 'utf8');
  } catch (err) {
    console.error('ReplaceFileError', err);
  }
};

const traverseFolderTree = (root = []) => {
  try {
    const contents = fs.readdirSync(path.resolve(path.dirname('package.json'), PATCH_PATH, ...root));
    for (let i = 0; i < contents.length; i += 1) {
      const currentContent = contents[i];
      const newPath = [...root, currentContent];
      const isDirectory = fs
        .lstatSync(path.resolve(path.dirname('package.json'), PATCH_PATH, ...newPath))
        .isDirectory();
      if (isDirectory) {
        traverseFolderTree(newPath);
      } else {
        console.log('INFO:', 'Replacing file', newPath.join('/'));
        replaceFile(newPath);
      }
    }
  } catch (err) {
    console.error('Error: TraverseFolderTree', err);
  }
};

traverseFolderTree();
