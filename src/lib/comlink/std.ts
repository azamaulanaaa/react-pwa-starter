import * as Comlink from "comlink";

const NAME_FUNCTION = "FUNCTION_PROXY";

if (!Comlink.transferHandlers.has(NAME_FUNCTION)) {
  Comlink.transferHandlers.set(NAME_FUNCTION, {
    canHandle: (val): val is Function => typeof val === "function",
    serialize: (val) => {
      const { port1, port2 } = new MessageChannel();
      Comlink.expose(val, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => Comlink.wrap(port),
  });
}
