/**
 * Vite serve plugin: mirrors HMR error/update payloads to custom events
 * that the on-screen DevRouteFileIndicator can reliably consume.
 * Also accepts agent debug NDJSON POSTs during debug sessions.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";

export function examNexusDevDebuggerBridge() {
  return {
    name: "examnexus-dev-debugger-bridge",
    apply: "serve",
    configureServer(server) {
      const send = server.ws.send.bind(server.ws);
      const debugLogPath = path.resolve(process.cwd(), ".cursor", "debug-c88187.log");

      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url?.split("?")[0] !== "/__agent_debug_log") {
          next();
          return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const line = raw.trim();
            if (line) {
              fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
              fs.appendFileSync(debugLogPath, `${line}\n`, "utf8");
            }
            res.statusCode = 204;
            res.end();
          } catch (error) {
            res.statusCode = 500;
            res.end(String(error?.message || error));
          }
        });
      });

      server.ws.send = (payload, ...rest) => {
        try {
          if (payload && typeof payload === "object") {
            if (payload.type === "error" && payload.err) {
              send({
                type: "custom",
                event: "en:dev-error",
                data: {
                  message: payload.err.message || "",
                  stack: payload.err.stack || "",
                  frame: payload.err.frame || "",
                  id: payload.err.id || payload.err.loc?.file || "",
                  plugin: payload.err.plugin || "",
                  loc: payload.err.loc || null,
                },
              });
            }

            if (payload.type === "update" && Array.isArray(payload.updates)) {
              send({
                type: "custom",
                event: "en:dev-update",
                data: {
                  updates: payload.updates.map((item) => ({
                    type: item?.type,
                    path: item?.path,
                    acceptedPath: item?.acceptedPath,
                  })),
                },
              });
            }
          }
        } catch {
          // Never block Vite's own HMR traffic.
        }

        return send(payload, ...rest);
      };
    },
  };
}
