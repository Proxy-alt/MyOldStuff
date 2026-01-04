import { readFile } from "node:fs/promises";
import { join } from "node:path";

export default async function (basePath: string, file: string | undefined, contentType: string = "application/javascript"): Promise<Response> {
  // Only allow within that directory
  if (file?.includes("..")) {
  return new Response("Invalid path", { status: 400 });
  }

  const fullPath = join(basePath, `${file}`);

  try {
    const data = await readFile(fullPath);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
