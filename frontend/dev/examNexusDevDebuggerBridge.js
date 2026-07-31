/**
 * Vite serve plugin: mirrors HMR error/update payloads to custom events
 * that the on-screen DevRouteFileIndicator can reliably consume.
 */
export function examNexusDevDebuggerBridge() {
  return {
    name: "examnexus-dev-debugger-bridge",
    apply: "serve",
    configureServer(server) {
      const send = server.ws.send.bind(server.ws);

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
