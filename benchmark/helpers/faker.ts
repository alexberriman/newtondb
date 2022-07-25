import { faker } from "@faker-js/faker";

export interface Scientist {
  id: number;
  name: string;
  dob: Date;
  country: string;
  countryCode: string;
  gender: string;
  department: string;
}

export function createFaker() {
  let id = 0;

  return (): Scientist => ({
    id: ++id,
    name: `${faker.name.firstName()} ${faker.name.lastName}`,
    dob: faker.date.birthdate(),
    country: faker.address.country(),
    countryCode: faker.address.countryCode(),
    gender: faker.name.gender(),
    department: faker.random.word(),
  });
}

export function createRecords(amount: number) {
  const $faker = createFaker();
  const scientists: Scientist[] = [];
  for (let x = 0; x < amount; x++) {
    scientists.push($faker());
  }

  return scientists;
}
