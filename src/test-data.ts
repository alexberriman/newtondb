export interface Wizard {
  id: number;
  name: string;
  house: string;
  born: number;
  married: boolean;
  wand?: string;
}

export interface House {
  id: string;
  emblem: string;
  headmasters: string[];
}

export const wizards: Wizard[] = [
  { id: 1, name: "harry", house: "gryffindor", born: 1980, married: true },
  { id: 2, name: "hermione", house: "gryffindor", born: 1979, married: false },
  { id: 3, name: "ron", house: "gryffindor", born: 1980, married: false },
  { id: 4, name: "draco", house: "slytherin", born: 1980, married: true },
];

export const extraWizards: Record<string, Wizard> = {
  neville: {
    id: 100,
    name: "neville",
    house: "gryffindor",
    born: 1980,
    married: false,
  },
  cho: {
    id: 101,
    name: "cho",
    house: "ravenclaw",
    born: 1980,
    married: true,
  },
};

export const houses: House[] = [
  {
    id: "gryffindor",
    emblem: "lion",
    headmasters: ["albus dumbledore", "minerva mcgonagall"],
  },
  { id: "hufflepuff", emblem: "badger", headmasters: [] },
  { id: "ravenclaw", emblem: "eagle", headmasters: [] },
  {
    id: "slytherin",
    emblem: "serpent",
    headmasters: [
      "elizabeth burke",
      "phineas nigellus black",
      "dolores umbridge",
      "severus snape",
    ],
  },
];
