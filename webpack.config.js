/* eslint-env node, browser:false */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const config = {
	mode: process.env.NODE_ENV,
	watchOptions: {
		// Avoid crazy CPU usage in some cases
		ignored: /node_modules/,
	},
	entry: {
		main: ['./src/main.ts'],
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/',
		filename: 'main.js',
	},
	resolve: {
		extensions: ['.js', '.ts'],
	},
	devServer: {
		overlay: true,
		contentBase: path.resolve(__dirname, 'dist'),
		allowedHosts: [
			'localhost',
		],
		host: '0.0.0.0',
		port: 8080,
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns:
				[
					{ from: './src/index.html' },
					{ from: './src/style.css' },
				],
		}),
		new ForkTsCheckerWebpackPlugin({
			eslint: {
				enabled: true,
				files: './src/**/*.{js,ts}',
			},
		}),
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: JSON.stringify(process.env.NODE_ENV),
			},
		}),
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: [{
					loader: 'ts-loader',
					options: {
						allowTsInNodeModules: true,
						transpileOnly: true,
					},
				}],
			},
			{
				test: /\.(png|jpe?g|gif|woff2?|eot|ttf|otf|svg|wav)(\?.*)?$/,
				use: 'url-loader',
			},
		],
	},
}

if (process.env.NODE_ENV === 'production') {
	config.optimization = {
		minimize: true,
		minimizer: [
			new TerserPlugin(),
		],
	}
} else {
	config.devtool = 'cheap-module-eval-source-map'
}

module.exports = config
