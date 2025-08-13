import fs from 'node:fs/promises';
import path from 'node:path';

export interface SurveyDefinition {
  title?: string;
  pages?: Array<{ title?: string; elements?: Array<Record<string, unknown>> }>;
  [key: string]: unknown;
}

export async function loadSurveyFromFile(filePath: string): Promise<SurveyDefinition> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  return JSON.parse(content) as SurveyDefinition;
}

export async function loadSurveysFromDir(dirPath: string): Promise<Record<string, SurveyDefinition>> {
  const absoluteDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const result: Record<string, SurveyDefinition> = {};

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    const full = path.join(absoluteDir, entry.name);
    const json = await loadSurveyFromFile(full);
    const key = path.basename(entry.name, '.json');
    result[key] = json;
  }

  return result;
}

export default {
  loadSurveyFromFile,
  loadSurveysFromDir,
};


