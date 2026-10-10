// The site publishes ../docs/guide as-is: that folder is the one product narrative.
import { themes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Nodum',
  tagline: 'Make it simple. Make it Node.',
  url: 'https://vilancer.github.io',
  baseUrl: '/nodum/',
  organizationName: 'Vilancer',
  projectName: 'nodum',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    format: 'detect',
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../docs/guide',
          routeBasePath: '/',
          sidebarPath: './sidebars.mjs',
          editUrl: 'https://github.com/Vilancer/nodum/edit/main/docs/guide/',
        },
        blog: false,
        pages: false,
        theme: { customCss: './src/css/custom.css' },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Nodum',
        items: [
          {
            href: 'https://github.com/Vilancer/nodum',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: 'Nodum · MIT',
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
      },
    }),
};

export default config;
