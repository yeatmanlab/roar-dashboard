const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
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
      crypto: false,
    },
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
        exclude: /node_modules/,
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
      title: 'ROAR — Levante Core Tasks',
    }),
    sentryWebpackPlugin({
      org: 'roar-89588e380',
      project: 'roar-levante-tasks',
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
    proxy: [
      {
        context: ['/v1'],
        target: process.env.BACKEND_URL ?? 'https://localhost:4000',
        secure: false,
        changeOrigin: true,
      },
    ],
  },
});

module.exports = async (env, args) => {
  const roarDB = env.dbmode;

  const envDependentConfig = {
    plugins: [
      new webpack.DefinePlugin({
        ROAR_DB: JSON.stringify(roarDB),
        ROAR_API_BASE_URL: JSON.stringify(process.env.ROAR_API_BASE_URL || '/v1'),
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
  };

  const devFirebaseConfig = {
    plugins: [
      new webpack.EnvironmentPlugin({
        FIREBASE_AUTH_EMULATOR_HOST: '',
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
