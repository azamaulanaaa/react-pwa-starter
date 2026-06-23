import * as Comlink from "comlink";

if (!Comlink.transferHandlers.has("AUTO_FUNCTION_PROXY")) {
  Comlink.transferHandlers.set("AUTO_FUNCTION_PROXY", {
    canHandle: (val): val is Function => typeof val === "function",
    serialize: (val) => {
      const { port1, port2 } = new MessageChannel();
      Comlink.expose(val, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => {
      return Comlink.wrap(port);
    },
  });
}
