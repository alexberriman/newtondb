type Mutation = any;

export class Chain<T> {
  mutations: Mutation[] = [];

  constructor(public data: T[] = []) {}

  get count() {
    return this.data.length;
  }

  get exists() {
    return this.data.length > 0;
  }

  addMutation(mutation: Mutation) {
    this.mutations = [...this.mutations, mutation];
  }
}
