/* eslint-env node, browser:false */
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')
const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin: CleanPlugin } = require('clean-webpack-plugin')
const ForkTsCheckerPlugin = require('fork-ts-checker-webpack-plugin')
const HtmlPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const config = {
	mode: process.env.NODE_ENV,
	watchOptions: {
		// Avoid crazy CPU usage in some cases
		ignored: /node_modules/,
	},
	entry: {
		main: ['./src/main.ts', './src/style.css'],
	},
	output: {
		filename: '[name].[hash].js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: './',
	},
	resolve: {
		extensions: ['.js', '.ts'],
	},
	devServer: {
		overlay: true,
		contentBase: path.resolve(__dirname, 'dist'),
		host: '0.0.0.0',
		port: 8080,
		publicPath: '/',
	},
	plugins: [
		new ForkTsCheckerPlugin({
			eslint: {
				enabled: true,
				files: './src/**/*.{js,ts}',
			},
		}),
		new MiniCssExtractPlugin({
			filename: 'style.[contenthash].css',
			chunkFilename: '[id].css',
		}),
		new CopyPlugin({
			patterns: [
				{ from: './src/favicon.png' },
				{ from: './src/opengraph.png' },
			],
		}),
		new HtmlPlugin({
			template: './src/index.html',
		}),
		new CleanPlugin(),
		new webpack.DefinePlugin({
			IS_PRODUCTION: JSON.stringify(process.env.NODE_ENV === 'production'),
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
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
				test: /\.css$/,
				use: [
					process.env.NODE_ENV === 'production'
						? MiniCssExtractPlugin.loader
						: 'style-loader',
					'css-loader',
				],
			},
			{
				test: /\.woff2$/,
				use: {
					loader: 'file-loader',
					options: {
						name: '[name].[ext]',
						outputPath: 'fonts/',
					},
				},
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
	config.devtool = 'eval-cheap-module-source-map'
}

module.exports = config
