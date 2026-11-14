// frontend/src/data/marsLocations.ts
export type MarsLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
};

export const MARS_LOCATIONS: MarsLocation[] = [
  {
    id: "jezero",
    name: "Jezero Crater",
    latitude: 18.38,
    longitude: 77.58,
    category: "Crater",
    description:
      "An ancient lakebed and river delta. Now the home of NASA's Perseverance rover.",
  },
  {
    id: "nili",
    name: "Nili Fossae",
    latitude: 21.0,
    longitude: 74.0,
    category: "Fossae",
    description:
      "A region of ancient fractures and exposed mineral deposits on Mars.",
  },
  {
    id: "syrtis",
    name: "Syrtis Major",
    latitude: 8.4,
    longitude: 67.5,
    category: "Volcanic Region",
    description:
      "A prominent dark volcanic region with a complex geological history.",
  },
  {
    id: "gale",
    name: "Gale Crater",
    latitude: -5.4,
    longitude: 137.8,
    category: "Crater",
    description:
      "An impact crater explored by NASA's Curiosity rover.",
  },
  {
    id: "valles",
    name: "Valles Marineris",
    latitude: -13.9,
    longitude: -59.2,
    category: "Canyon System",
    description:
      "A vast canyon system extending across the Martian surface.",
  },
  {
    id: "olympus",
    name: "Olympus Mons",
    latitude: 18.65,
    longitude: -133.8,
    category: "Volcano",
    description:
      "A giant shield volcano and one of the largest volcanoes in the Solar System.",
  },
];
