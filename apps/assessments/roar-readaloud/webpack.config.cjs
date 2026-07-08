const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
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
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];

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
    },
  },
  module: {
    rules: [
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
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
          filename: 'img/[name].[ext]',
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
      title: 'Rapid Online Assessment of Reading - Aloud',
    }),
    sentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'roar-89588e380',
      project: 'roar-readaloud',
      debug: true,
      errorHandler: (err) => {
        console.warn(err);
      },
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          // onnxruntime-web is hoisted to the monorepo root node_modules, so resolve its
          // dist dir rather than assuming a local install. (Its package.json isn't exposed
          // via `exports`, so resolve the main entry and take its directory.)
          from: path.join(path.dirname(require.resolve('onnxruntime-web')), '*.wasm'),
          to: '[name][ext]',
        },
        {
          from: 'src/experiment/views/eyetracking_google.onnx',
          to: 'views/eyetracking_google.onnx',
        },
      ],
    }),
  ],
});

const productionConfig = merge(webConfig, {
  mode: 'production',
});

const developmentConfig = merge(webConfig, {
  mode: 'development',
  devServer: {
    port: 8000,
    static: './dist',
    client: {
      overlay: false,
    },
    // Proxy the ts-rest backend so the SDK client's `/v1` calls (e.g. anonymous sign-in)
    // reach the backend on :4000 rather than 404ing against the dev server.
    proxy: [
      {
        context: ['/v1'],
        target: process.env.BACKEND_URL ?? 'http://localhost:4000',
        secure: false,
        changeOrigin: true,
      },
    ],
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'require-corp'
    // }
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
      new webpack.ids.HashedModuleIdsPlugin(), // so that file hashes don't change unexpectedly
      new webpack.DefinePlugin({
        ROAR_DB: JSON.stringify(roarDB),
        ROAR_API_BASE_URL: JSON.stringify(process.env.ROAR_API_BASE_URL ?? '/v1'),
        ...devFirebaseConfig,
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new webpack.EnvironmentPlugin({
        FIREBASE_AUTH_EMULATOR_HOST: '',
      }),
    ],
  };

  switch (args.mode) {
    case 'development':
      return merge(developmentConfig, envDependentConfig);
    case 'production':
      return merge(productionConfig, envDependentConfig);
    default:
      throw new Error('No matching configuration was found!');
  }
};
