import type { Node } from "./data";

/** In-memory disconnection only; deliberately has no filesystem dependencies. */
export function disconnectedIds(nodes: Node[], rootId: string): Set<string> {
  const root = nodes.find((node) => node.id === rootId);
  if (!root || root.parentId !== null || root.kind !== "folder") return new Set();
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
    }
  }
  return ids;
}