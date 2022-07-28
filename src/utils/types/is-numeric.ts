export function isNumeric(value: unknown) {
  return (
    typeof value === "number" ||
    (typeof value === "string" && parseInt(value, 10).toString() === value)
  );
}
