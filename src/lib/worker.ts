import * as Comlink from "comlink";
import { Effect } from "effect";

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

if (!Comlink.transferHandlers.has("EFFECT_PROXY")) {
  Comlink.transferHandlers.set("EFFECT_PROXY", {
    canHandle: (val): val is Effect.Effect<any, any, never> =>
      Effect.isEffect(val),
    serialize: (effectInstance: Effect.Effect<any, any, never>) => {
      const { port1, port2 } = new MessageChannel();
      const executionPromise = () => Effect.runPromise(effectInstance);
      Comlink.expose(executionPromise, port1);
      return [port2, [port2]];
    },
    deserialize: (port: MessagePort) => {
      const proxyFunc = Comlink.wrap<() => Promise<any>>(port);
      return proxyFunc();
    },
  });
}
