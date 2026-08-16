import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        mime: z.string().min(1),
        dataUrl: z.string().min(1),
      }),
    )
    .min(1),
  category: z.string().default(""),
});

export const readDrawing = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { readDrawingStrict } = await import("./extraction.server");
    return readDrawingStrict(data);
  });
