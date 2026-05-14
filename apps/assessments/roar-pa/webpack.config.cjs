const path = require('path');
const webpack = require('webpack');
// eslint-disable-next-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge');
// eslint-disable-next-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const dotenv = require('dotenv');
dotenv.config();

const commonConfig = {
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // get the name. E.g. node_modules/packageName/not/this/part.js
            // or node_modules/packageName
            const packageName = module.request?.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
            return packageName ? `npm.${packageName.replace('@', '')}` : 'vendor';
          },
          chunks: 'all',
        },
      },
    },
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
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
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
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
              // download: true,
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              // name: "[name].[ext]",
              // outputPath: "corpora",
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
      title: 'Rapid Online Assessment of Reading - PA',
    }),
    sentryWebpackPlugin({
      org: 'roar-89588e380',
      project: 'pa',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      debug: true,
      errorHandler: (err) => {
        console.warn(err);
      },
    }),
  ],
});

const productionConfig = merge(webConfig, {
  mode: 'production',
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
  },
});

module.exports = async (env, args) => {
  const roarDB = env.dbmode;

  const envDependentConfig = {
    plugins: [
      new webpack.DefinePlugin({
        ROAR_DB: JSON.stringify(roarDB),
        ROAR_API_URL: JSON.stringify(process.env.ROAR_API_URL || 'https://localhost:4000'),
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
  };

  // Firebase config is injected via EnvironmentPlugin only for local dev builds.
  // Staging and production deployments fetch firebase config at runtime from /__/firebase/init.json
  // (served automatically by Firebase Hosting), so no secrets enter the build pipeline.
  const devFirebaseConfig = {
    plugins: [
      new webpack.EnvironmentPlugin({
        FIREBASE_APP_API_KEY: '',
        FIREBASE_APP_AUTH_DOMAIN: '',
        FIREBASE_APP_PROJECT_ID: '',
        FIREBASE_APP_STORAGE_BUCKET: '',
        FIREBASE_APP_MESSAGING_SENDER_ID: '',
        FIREBASE_APP_APP_ID: '',
        ROAR_API_URL: 'https://localhost:4000',
      }),
    ],
  };

  switch (args.mode) {
    case 'development':
      return merge(developmentConfig, envDependentConfig, devFirebaseConfig);
    case 'production':
      return merge(productionConfig, envDependentConfig);
    default:
      throw new Error('No matching configuration was found!');
  }
};
