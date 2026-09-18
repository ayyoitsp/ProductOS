import { Hono } from "hono";
import { buildPacket, renderPacketMarkdown } from "../lib/packet.js";

export const packetRoute = new Hono();

packetRoute.get("/:area/:slug", async (c) => {
  const containerId = `${c.req.param("area")}/${c.req.param("slug")}`;
  const format = c.req.query("format") ?? "md";

  const packet = await buildPacket(containerId);
  if (!packet) return c.json({ error: "not_found", containerId }, 404);

  if (format === "json") return c.json(packet);

  return c.text(renderPacketMarkdown(packet), 200, {
    "content-type": "text/markdown; charset=utf-8",
  });
});
