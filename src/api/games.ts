import { z } from 'zod';

const GamesSchema = z.array(
    z.object({
        title: z.string(),
        url: z.string().url(),
        cover_url: z.string().optional(),
    })
)

export type Games = z.infer<typeof GamesSchema>


export default async function getAllGames() {
    const response = await fetch('https://itch.io/api/1/iCQzGljw8jsSCmjYNewsqHDS7ew1ukuXiCOmaXqg/my-games')
    const result = await response.json();

    if (GamesSchema.safeParse(result["games"]).success) {
        console.log("Itch.io games are successfully retrieved and schema is matched")
        return result["games"];
    }
    else {
        console.log("Itch.io API failed to get all the games and it doesn't match the schema.")
        return [];
    }
}