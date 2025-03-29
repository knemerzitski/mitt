export type BaseEvents = object;

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (event: T) => void;
export type WildcardHandler<T = Record<string, unknown>> = (
	payload: PickEventUnion<T, keyof T>
) => void;

type PickEventUnion<T, P extends keyof T> = {
	[K in keyof T]-?: {
		type: K;
		event: T[K];
	};
}[P];
export type PickHandler<T, K extends keyof T> = (
	payload: PickEventUnion<T, K>
) => void;

// An array of all currently registered event handlers for a type
export type EventHandlerList<T = unknown> = Array<Handler<T>>;
export type WildCardEventHandlerList<T = Record<string, unknown>> = Array<
	WildcardHandler<T>
>;

// A map of event types and their corresponding event handlers.
export type EventHandlerMap<Events extends BaseEvents> = Map<
	keyof Events | '*',
	EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>;

export type EmitterEvents<T> = T extends Emitter<infer R>
	? R
	: T extends LimitedEmitter<infer R>
	? R
	: never;

export type EmitterPickEvents<
	T extends LimitedEmitter<any>,
	P extends keyof EmitterEvents<T>
> = LimitedEmitter<Pick<EmitterEvents<T>, P>>;

interface LimitedEmitter<Events extends BaseEvents> {
	on<Key extends keyof Events>(
		type: Key,
		handler: Handler<Events[Key]>
	): () => void;

	on<Key extends keyof Events>(
		types: Key[],
		handler: Handler<Events[Key]>
	): () => void;

	off<Key extends keyof Events>(
		type: Key,
		handler?: Handler<Events[Key]>
	): void;

	emit<Key extends keyof Events>(type: Key, event: Events[Key]): void;
	emit<Key extends keyof Events>(
		type: undefined extends Events[Key] ? Key : never
	): void;
}

export interface Emitter<Events extends BaseEvents> {
	all: EventHandlerMap<Events>;

	on<Key extends keyof Events>(
		type: Key,
		handler: Handler<Events[Key]>
	): () => void;
	on<Key extends keyof Events>(
		types: Key[],
		handler: PickHandler<Events, Key>
	): () => void;
	on(type: '*', handler: WildcardHandler<Events>): () => void;

	off<Key extends keyof Events>(handler: Handler<Events[Key]>): void;
	off<Key extends keyof Events>(
		type: Key,
		handler?: Handler<Events[Key]>
	): void;
	off(type: '*', handler: WildcardHandler<Events>): void;

	emit<Key extends keyof Events>(type: Key, event: Events[Key]): void;
	emit<Key extends keyof Events>(
		type: undefined extends Events[Key] ? Key : never
	): void;
}

/**
 * Mitt: Tiny (~200b) functional event emitter / pubsub.
 * @name mitt
 * @returns {Mitt}
 */
export default function mitt<Events extends BaseEvents>(
	all?: EventHandlerMap<Events>
): Emitter<Events> {
	type GenericEventHandler =
		| Handler<Events[keyof Events]>
		| PickHandler<Events, keyof Events>
		| WildcardHandler<Events>;
	all = all || new Map();

	function _on<Key extends keyof Events>(
		type: Key,
		handler: GenericEventHandler
	) {
		const handlers: Array<GenericEventHandler> | undefined = all!.get(type);
		if (handlers) {
			handlers.push(handler);
		} else {
			all!.set(type, [handler] as EventHandlerList<Events[keyof Events]>);
		}

		return () => {
			off(type, handler);
		};
	}

	// eslint-disable-next-line no-spaced-func
	const onArrayStateByHandler = new WeakMap<
		object,
		{ off: () => void; count: number }
	>();
	function _onArray<Key extends keyof Events>(
		types: Key[],
		handler: PickHandler<Events, Key>
	) {
		const state = onArrayStateByHandler.get(handler);
		if (state) {
			state.count++;
			return state.off;
		}

		const localOffs = types.map((type) =>
			_on(type, (event: any) => {
				handler({ type, event });
			})
		);
		const offAll = () => {
			localOffs.forEach((localOff) => localOff());
		};
		if (onArrayStateByHandler.has(handler)) {
			onArrayStateByHandler.get(handler)!.count++;
		} else {
			onArrayStateByHandler.set(handler, { off: offAll, count: 1 });
		}

		return offAll;
	}

	/**
	 * Register an event handler for the given type.
	 * @param {string|symbol} type Type of event to listen for, or `'*'` for all events
	 * @param {Function} handler Function to call in response to given event
	 * @memberOf mitt
	 */
	function on<Key extends keyof Events>(
		type: Key | Key[],
		handler: GenericEventHandler
	) {
		if (Array.isArray(type)) {
			return _onArray(type, handler as PickHandler<Events, Key>);
		}

		return _on(type, handler);
	}

	/**
	 * Remove an event handler for the given type.
	 * If `handler` is omitted, all handlers of the given type are removed.
	 * @param {string|symbol} type Type of event to unregister `handler` from (`'*'` to remove a wildcard handler)
	 * @param {Function} [handler] Handler function to remove
	 * @memberOf mitt
	 */
	function off<Key extends keyof Events>(
		type: Key | GenericEventHandler,
		handler?: GenericEventHandler
	) {
		if (typeof type === 'string') {
			const handlers: Array<GenericEventHandler> | undefined = all!.get(type);
			if (handlers) {
				if (handler) {
					handlers.splice(handlers.indexOf(handler) >>> 0, 1);
				} else {
					all!.set(type, []);
				}
			}
		} else if (typeof type === 'function') {
			const handler = type;
			const state = onArrayStateByHandler.get(handler);
			if (!state) {
				return;
			}

			if (state?.count <= 1) {
				state.off();
				onArrayStateByHandler.delete(handler);
			} else {
				state.count--;
			}
		}
	}

	/**
	 * Invoke all handlers for the given type.
	 * If present, `'*'` handlers are invoked after type-matched handlers.
	 *
	 * Note: Manually firing '*' handlers is not supported.
	 *
	 * @param {string|symbol} type The event type to invoke
	 * @param {Any} [evt] Any value (object is recommended and powerful), passed to each handler
	 * @memberOf mitt
	 */
	function emit<Key extends keyof Events>(type: Key, evt?: Events[Key]) {
		let handlers = all!.get(type);
		if (handlers) {
			(handlers as EventHandlerList<Events[keyof Events]>)
				.slice()
				.map((handler) => {
					handler(evt!);
				});
		}

		handlers = all!.get('*');
		if (handlers) {
			(handlers as WildCardEventHandlerList<Events>).slice().map((handler) => {
				handler({
					type,
					event: evt!
				});
			});
		}
	}

	return {
		/**
		 * A Map of event names to registered handler functions.
		 */
		all,
		on,
		off,
		emit
	};
}
