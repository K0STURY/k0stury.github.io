/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				'primary': 'var(--primary-color)',
				'secondary': 'var(--secondary-color)',
				'color': 'var(--text-color)'
			},
			animation: {
				'gelatine-infite': 'gelatine 0.375s infinite',
				'gelatine-in-out': 'gelatine 0.375s ease-in-out'
			},
			fontFamily: {
				'content': ['inter'],
				'stylized': ['Rancho', 'cursive'],
			}
		},
	},
	plugins: [],
}
