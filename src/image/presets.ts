import byeByePokemonUrl from "../../images/bye-bye-pokemon.gif?url";
import javaDukeUrl from "../../images/java_duke.jpeg?url";
import pikachuPngUrl from "../../images/pikachu.png?url";
import pikachuWebPUrl from "../../images/pikachu.webp?url";

export type ImagePreset = {
  name: string;
  fileName: string;
  mimeType: string;
  url: string;
};

export const IMAGE_PRESETS: readonly ImagePreset[] = [
  {
    name: "Java Duke",
    fileName: "java_duke.jpeg",
    mimeType: "image/jpeg",
    url: javaDukeUrl,
  },
  {
    name: "Pikachu",
    fileName: "pikachu.png",
    mimeType: "image/png",
    url: pikachuPngUrl,
  },
  {
    name: "Animated Pikachu",
    fileName: "pikachu.webp",
    mimeType: "image/webp",
    url: pikachuWebPUrl,
  },
  {
    name: "Bye-bye Pokémon",
    fileName: "bye-bye-pokemon.gif",
    mimeType: "image/gif",
    url: byeByePokemonUrl,
  },
];
