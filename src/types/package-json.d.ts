declare module '../../package.json' {
  interface PackageJson {
    name: string;
    version: string;
    dependencies: {
      [key: string]: string;
    };
    devDependencies: {
      [key: string]: string;
    };
  }
  
  const packageJson: PackageJson;
  export default packageJson;
} 