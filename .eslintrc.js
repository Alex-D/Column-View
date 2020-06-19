/* eslint-env node, browser:false */

module.exports = {
	'env': {
		'browser': true,
		'es6': true,
	},
	'extends': [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
	],
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'project': './tsconfig.json',
	},
	'plugins': [
		'@typescript-eslint',
	],
	'rules': {
		'comma-dangle': [
			'error',
			'always-multiline',
		],
		'@typescript-eslint/ban-ts-comment': [
			'error',
			{
				'ts-ignore': 'allow-with-description',
			},
		],
	},
}
