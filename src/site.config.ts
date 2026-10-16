export interface ContactProps {
  name: string;
  value: string;
  icon: string;
  link?: string;
}

export const contacts: ContactProps[] = [
  {
    name: "Discord",
    value: "K0STUR",
    icon: "ri:discord-fill",
    link: "https://discord.com/users/206867415210917888",
  },
  {
    name: "Itch.io",
    value: "Itch.io",
    icon: "mdi:games-outline",
    link: "https://k0stur.itch.io/",
  },
  {
    name: "Location",
    value: "Sweden",
    icon: "mdi:location-on-outline",
    link: "https://en.wikipedia.org/wiki/Sweden",
  },
];

export const details = {
  aboutMe:
    "<strong>YO!</strong> I'm Kostur, and I make art for fun. I love using bright colors in my works and creating something enjoyable.",
};

// Shown in the about section's "tools I use" row; add software or hardware here
export const tools: string[] = ["Affinity Designer V2", "Mouse :)"];

export const globals = {
  imageQuality: "max", // low, mid, high or max
};

// The dev log (/blog). false keeps it off the live site: no pages, no "Dev log" link in the nav.
// It always shows while running `npm run dev`, so it can be worked on before it goes live.
export const blogLive = false;
