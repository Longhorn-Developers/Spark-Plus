import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		ignores: [
			"worker-configuration.d.ts",
			"node_modules/",
			"dist/",
			".wrangler/",
		],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: { react },
		languageOptions: {
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		rules: {
			"no-debugger": "off",
			"no-unused-vars": "warn",
			"no-await-in-loop": "warn",
			"react/react-in-jsx-scope": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/no-explicit-any": "warn",
			"no-useless-escape": "warn",
		},
	},
);
