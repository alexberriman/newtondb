const isMatch =
  <Node, Data>(
    condition: Partial<Data>,
    preProcessor?: (input: Node) => Data
  ) =>
  (item: Node) => {
    const data = (preProcessor ? preProcessor(item) : item) as Data;

    return Object.entries(condition).every(
      ([key, value]) => data[key as keyof Data] === value
    );
  };

export function query<Node, Data>(
  data: Node[],
  condition: Partial<Data>,
  preProcessor?: (input: Node) => Data
): Node[] {
  const fn = isMatch(condition, preProcessor);

  return data.filter(fn);
}

export function get<Node, Data>(
  data: Node[],
  condition: Partial<Data>,
  preProcessor?: (input: Node) => Data
): Node | undefined {
  const fn = isMatch(condition, preProcessor);

  return data.find(fn);
}
