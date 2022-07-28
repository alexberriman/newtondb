import { wizards } from "../../test-data";
import { flatten } from "./flatten";

test("flatten", () => {
  expect(
    flatten([
      [{ op: "remove", path: '/{"id":2}/0' }],
      [{ op: "remove", path: '/{"id":3}/0' }],
    ])
  ).toEqual([
    { op: "remove", path: '/{"id":2}/0' },
    { op: "remove", path: '/{"id":3}/0' },
  ]);

  const flatWizards = flatten([wizards[0], [wizards[1], [[wizards[2]]]]]);
  expect(flatWizards).toEqual([wizards[0], wizards[1], wizards[2]]);

  expect(
    flatten([
      [{ op: "remove", path: '/{"id":2}/0' }],
      [{ op: "remove", path: '/{"id":3}/0' }],
      [
        [{ op: "remove", path: '/{"id":4}/0' }],
        [{ op: "remove", path: '/{"id":5}/0' }],
      ],
      [
        [
          [{ op: "remove", path: '/{"id":6}/0' }],
          [{ op: "remove", path: '/{"id":7}/0' }],
        ],
        [{ op: "remove", path: '/{"id":8}/0' }],
      ],
    ])
  ).toEqual([
    { op: "remove", path: '/{"id":2}/0' },
    { op: "remove", path: '/{"id":3}/0' },
    { op: "remove", path: '/{"id":4}/0' },
    { op: "remove", path: '/{"id":5}/0' },
    { op: "remove", path: '/{"id":6}/0' },
    { op: "remove", path: '/{"id":7}/0' },
    { op: "remove", path: '/{"id":8}/0' },
  ]);
});
