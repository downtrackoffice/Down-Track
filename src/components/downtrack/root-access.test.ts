import { test, expect } from "bun:test";
import { disconnectedIds } from "./root-access";
import type { Node } from "./data";

test("disconnecting root access only removes its in-app subtree, not other roots or source records", () => {
  const nodes: Node[] = [
    { id: "root", parentId: null, name: "שירים", kind: "folder", status: "saved" },
    { id: "child", parentId: "root", name: "אלבום", kind: "folder", status: "saved" },
    { id: "song", parentId: "child", name: "שיר.mp3", kind: "mp3", status: "pending", op: "add" },
    { id: "other", parentId: null, name: "Other", kind: "folder", status: "saved" },
  ];
  const original = structuredClone(nodes);
  const ids = disconnectedIds(nodes, "root");
  expect([...ids]).toEqual(["root", "child", "song"]);
  expect(nodes.filter((node) => !ids.has(node.id))).toEqual([original[3]]);
  expect(nodes).toEqual(original);
});

test("a nested folder cannot be disconnected as a root", () => {
  expect(disconnectedIds([
    { id: "child", parentId: "root", name: "Album", kind: "folder", status: "saved" },
  ], "child").size).toBe(0);
});