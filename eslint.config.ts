import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import prettier from 'eslint-plugin-prettier-vue';

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
    {
        name: 'app/files-to-lint',
        files: ['**/*.{ts,mts,tsx,vue}'],
    },

    globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

    pluginVue.configs['flat/essential'],
    vueTsConfigs.recommended,

    {
        ...pluginVitest.configs.recommended,
        files: ['src/**/__tests__/*'],
    },
    {
        rules: {
            'vue/multi-word-component-names': 'off',
        },
        files: ['**/*.vue'],
    },
    {
        plugins: {
            'prettier-vue': prettier,
        },
        rules: {
            'prettier-vue/prettier': [
                'error',
                {
                    semi: true,
                },
            ],
            'vue/valid-v-slot': ['error', { allowModifiers: true }],
        },
        files: ['**/*.{ts,mts,tsx,vue}'],
    },
    skipFormatting,
);
