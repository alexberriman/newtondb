import { orderBy } from "./order-by";

describe("orderBy", () => {
  const objects = [
    { a: "x", b: 3 },
    { a: "y", b: 4 },
    { a: "x", b: 1 },
    { a: "y", b: 2 },
  ];

  const nestedObj = [
    { id: "4", address: { zipCode: 4, streetName: "Beta" } },
    { id: "3", address: { zipCode: 3, streetName: "Alpha" } },
    { id: "1", address: { zipCode: 1, streetName: "Alpha" } },
    { id: "2", address: { zipCode: 2, streetName: "Alpha" } },
    { id: "5", address: { zipCode: 4, streetName: "Alpha" } },
  ];

  it("should sort by numeric value", () => {
    expect(orderBy(objects, "b")).toEqual([
      { a: "x", b: 1 },
      { a: "y", b: 2 },
      { a: "x", b: 3 },
      { a: "y", b: 4 },
    ]);
  });

  it("should sort by a single property by a specified order", () => {
    expect(orderBy(objects, "a", "desc")).toEqual([
      { a: "y", b: 4 },
      { a: "y", b: 2 },
      { a: "x", b: 3 },
      { a: "x", b: 1 },
    ]);
  });

  it("should sort by nested key in array format", () => {
    expect(
      orderBy(
        nestedObj,
        [["address", "zipCode"], ["address.streetName"]],
        ["asc", "desc"]
      )
    ).toMatchObject([
      { id: "1" },
      { id: "2" },
      { id: "3" },
      { id: "4" },
      { id: "5" },
    ]);
  });

  it("should sort by multiple properties by specified orders", () => {
    const actual = orderBy(objects, ["a", "b"], ["desc", "asc"]);
    expect(actual).toEqual([
      { a: "y", b: 2 },
      { a: "y", b: 4 },
      { a: "x", b: 1 },
      { a: "x", b: 3 },
    ]);
  });

  it("should sort by a property in ascending order when its order is not specified", () => {
    expect(orderBy(objects, ["a", "b"])).toEqual([
      { a: "x", b: 1 },
      { a: "x", b: 3 },
      { a: "y", b: 2 },
      { a: "y", b: 4 },
    ]);
  });
});
