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
    link: "discordapp.com/users/206867415210917888",
  },
  {
    name: "Itch.io",
    value: "https://k0stur.itch.io/",
    icon: "mdi:games-outline",
    link: "https://k0stur.itch.io/",
  },
  {
    name: "Location",
    value: "Sweden",
    icon: "mdi:location-on-outline",
  },
];

export const details = {
  aboutMe:
    "<strong>YO!</strong> I'm Kostur, and I make art for fun. I love using bright colors in my works and creating something enjoyable.",
};

export const globals = {
  imageQuality: "max", // low, mid, high or max
};
