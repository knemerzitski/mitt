export type BaseEvents = object;

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (event: T) => void;
export type WildcardHandler<T = Record<string, unknown>> = (
	type: keyof T,
	event: T[keyof T]
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
		handler: Handler<Events[Key]>
	): () => void;
	on(type: '*', handler: WildcardHandler<Events>): () => void;

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

	function _onArray<Key extends keyof Events>(
		types: Key[],
		handler: GenericEventHandler
	) {
		types.forEach((type) => _on(type, handler));

		return () => {
			types.forEach((type) => off(type, handler));
		};
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
			return _onArray(type, handler);
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
		type: Key,
		handler?: GenericEventHandler
	) {
		const handlers: Array<GenericEventHandler> | undefined = all!.get(type);
		if (handlers) {
			if (handler) {
				handlers.splice(handlers.indexOf(handler) >>> 0, 1);
			} else {
				all!.set(type, []);
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
				handler(type, evt!);
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
