export default async function getAllGames() {
    const response = await fetch('https://itch.io/api/1/iCQzGljw8jsSCmjYNewsqHDS7ew1ukuXiCOmaXqg/my-games')
    const result = await response.json();

    return result["games"];
}