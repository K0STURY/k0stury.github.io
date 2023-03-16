import type { APIRoute } from 'astro';

export const get: APIRoute = async function get({ params, request }) {
    const response = await fetch('https://itch.io/api/1/iCQzGljw8jsSCmjYNewsqHDS7ew1ukuXiCOmaXqg/my-games')
    const result = await response.json();

    return {
        body: JSON.stringify(result)
    }
}