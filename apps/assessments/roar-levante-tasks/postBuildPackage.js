// Updates the package.json after building the package.
import fs from 'fs';
import path from 'path';

const outputDir = 'lib';

const files = fs.readdirSync(outputDir);

const outputFile = files.find((file) => file.startsWith('index') && file.endsWith('.js'));

if (!outputFile) {
  throw new Error(
    "Could not find the output file starting with 'index'. Ensure the build process is generating it correctly.",
  );
}

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Update the fields in package.json
packageJson.main = path.join(outputDir, outputFile);
packageJson.module = path.join(outputDir, outputFile);

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
