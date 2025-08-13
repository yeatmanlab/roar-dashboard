import { config } from '@dotenvx/dotenvx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load dotenv files
 *
 * This function extends the default Vite behaviour for dotenv files by loading environment variables from dotenv files
 * located in the env-configs/ directory. This directory is a submodule containing environment-specific dotenv files,
 * all encrypted using dotenvx. This function will load the dotenv file corresponding to the current mode (development,
 * production, etc.) as well as the local mode override file and decrypt the contents into process.env for Vite to use.
 *
 * It is worth noting that any fork of the project not using the env-configs submodule can safely use a regular dotenv
 * file at the root of the project, as Vite will automatically load it.
 *
 * @returns {void}
 */
export const loadDotenvFiles = (mode) => {
  let envFilePaths = [];
  const allowOverride = !mode.includes('production') && !mode.includes('staging');

  const modeEnvFilePath = path.resolve(__dirname, `../env-configs/.env.${mode}`);
  const modeLocalEnvFileName = path.resolve(__dirname, `../env-configs/.env.${mode}.local`);

  if (fs.existsSync(modeEnvFilePath)) envFilePaths.push(modeEnvFilePath);
  if (allowOverride & fs.existsSync(modeLocalEnvFileName)) envFilePaths.push(modeLocalEnvFileName);

  config({
    path: envFilePaths,
    override: allowOverride,
  });
};
