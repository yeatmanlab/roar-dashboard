const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

dotenv.config();

const { merge } = require('webpack-merge');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

const commonConfig = {
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            const packageName = module.request?.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1] ?? 'vendor';

            // npm package names are URL-safe, but some servers don't like @ symbols
            return `npm.${packageName.replace('@', '')}`;
          },
          chunks: 'all',
        },
      },
    },
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      crypto: false,
      os: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.scss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'img/[name][ext]',
        },
      },
      {
        test: /\.mp3$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
              outputPath: 'audio',
            },
          },
        ],
      },
      {
        test: /\.mp4$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'video',
            },
          },
        ],
      },
      {
        test: /\.csv$/,
        use: [
          {
            loader: 'csv-loader',
            options: {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
            },
          },
        ],
      },
    ],
  },
  experiments: {
    topLevelAwait: true,
  },
};

const webConfig = merge(commonConfig, {
  entry: {
    index: path.resolve(__dirname, 'serve', 'serve.js'),
  },
  output: {
    filename: '[name].[contenthash].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: {
      keep: /\.git/,
    },
  },
  devtool: 'source-map',
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Rapid Online Assessment of Reading - Multichoice',
    }),
    sentryWebpackPlugin({
      org: 'roar-89588e380',
      project: 'multichoice',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      deleteSourcemapsAfterUpload: true,
      debug: true,
      errorHandler: (err) => {
        console.warn(err);
      },
    }),
  ],
});

const productionConfig = merge(webConfig, {
  mode: 'production',
  devtool: false,
});

const developmentConfig = merge(webConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    port: 8000,
    static: './dist',
    client: {
      overlay: false,
    },
    proxy: [
      {
        context: ['/v1'],
        target: process.env.BACKEND_URL ?? 'http://localhost:4000',
        secure: false,
        changeOrigin: true,
      },
    ],
  },
});

module.exports = async (env, args) => {
  const roarDB = env.dbmode ?? 'development';

  const devFirebaseConfig =
    roarDB === 'development'
      ? {
          FIREBASE_AUTH_EMULATOR_HOST: JSON.stringify(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? ''),
        }
      : {};

  const envDependentConfig = {
    plugins: [
      new webpack.DefinePlugin({
        ROAR_DB: JSON.stringify(roarDB),
        ROAR_API_BASE_URL: JSON.stringify(process.env.ROAR_API_BASE_URL ?? '/v1'),
        ...devFirebaseConfig,
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
  };

  // Injected only into local dev builds. Staging and production bundles must not
  // carry this default: a truthy FIREBASE_AUTH_EMULATOR_HOST makes getFirebaseConfig()
  // take the emulator path in end users' browsers instead of fetching
  // /__/firebase/init.json from Firebase Hosting.
  const devEmulatorConfig = {
    plugins: [
      new webpack.EnvironmentPlugin({
        // Defaults to the local Auth emulator — assessment development always runs
        // against the emulator, never a real Firebase project. An explicit
        // FIREBASE_AUTH_EMULATOR_HOST env var still overrides this default.
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      }),
    ],
  };

  switch (args.mode) {
    case 'development':
      return merge(developmentConfig, envDependentConfig, devEmulatorConfig);
    case 'production':
      return merge(productionConfig, envDependentConfig);
    default:
      throw new Error('No matching configuration was found!');
  }
};
