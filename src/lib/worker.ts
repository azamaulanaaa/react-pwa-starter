import * as Comlink from "comlink";
import { Effect, Stream } from "effect";

if (!Comlink.transferHandlers.has("EFFECT_STREAM_PROXY")) {
  Comlink.transferHandlers.set("EFFECT_STREAM_PROXY", {
    canHandle: (val): val is Stream.Stream<any, any, any> =>
      val !== null &&
      (typeof val === "object" || typeof val === "function") &&
      Stream.StreamTypeId in val,

    serialize: (streamInstance: Stream.Stream<any, any, never>) => {
      const { port1, port2 } = new MessageChannel();
      const asyncIterable = Stream.toAsyncIterable(streamInstance);

      const streamController = {
        async getReader() {
          const iterator = asyncIterable[Symbol.asyncIterator]();

          const iteratorController = {
            async next() {
              const result = await iterator.next();
              return { value: result.value, done: result.done };
            },
            async return() {
              if (typeof iterator.return === "function") {
                await iterator.return();
              }
              return { value: undefined, done: true };
            },
          };

          const { port1: iterPort1, port2: iterPort2 } = new MessageChannel();
          Comlink.expose(iteratorController, iterPort1);
          return Comlink.transfer(iterPort2, [iterPort2]);
        },
      };

      Comlink.expose(streamController, port1);
      return [port2, [port2]];
    },

    deserialize: (port: MessagePort) => {
      const remoteController = Comlink.wrap<
        { getReader(): Promise<MessagePort> }
      >(port);
      let iterPort: MessagePort | null = null;
      let remoteIterator: any = null;

      return new ReadableStream({
        async start(controller) {
          try {
            iterPort = await remoteController.getReader();
            remoteIterator = Comlink.wrap<{
              next(): Promise<IteratorResult<any>>;
              return(): Promise<IteratorResult<any>>;
            }>(iterPort);
          } catch (err) {
            controller.error(err);
          }
        },
        async pull(controller) {
          if (!remoteIterator) return;
          try {
            const { value, done } = await remoteIterator.next();
            if (done) {
              controller.close();
              if (iterPort) iterPort.close();
            } else {
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
            if (iterPort) iterPort.close();
          }
        },
        async cancel() {
          try {
            if (remoteIterator) await remoteIterator.return();
          } catch (err) {
            console.error("Failed to cleanly cancel remote stream scope:", err);
          } finally {
            if (iterPort) iterPort.close();
          }
        },
      });
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
