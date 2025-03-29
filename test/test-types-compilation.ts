/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */

import mitt from '..';

interface SomeEventData {
	name: string;
}

const emitter = mitt<{
	foo: string;
	someEvent: SomeEventData;
	bar?: number;
}>();

const barHandler = (x?: number) => {};
const fooHandler = (x: string) => {};
const wildcardHandler = (
	_payload:
		| {
				type: 'foo';
				event: string;
		  }
		| {
				type: 'bar';
				event: number | undefined;
		  }
		| {
				type: 'someEvent';
				event: SomeEventData;
		  }
) => {};

/*
 * Check that 'on' args are inferred correctly
 */
{
	// @ts-expect-error
	emitter.on('foo', barHandler);
	emitter.on('foo', fooHandler);

	emitter.on('bar', barHandler);
	// @ts-expect-error
	emitter.on('bar', fooHandler);

	emitter.on('*', wildcardHandler);
	// @ts-expect-error
	emitter.on('*', barHandler);
}

/*
 * Check that 'off' args are inferred correctly
 */
{
	// @ts-expect-error
	emitter.off('foo', barHandler);
	emitter.off('foo', fooHandler);

	emitter.off('bar', barHandler);
	// @ts-expect-error
	emitter.off('bar', fooHandler);

	emitter.off('*', wildcardHandler);
	// @ts-expect-error
	emitter.off('*', barHandler);
}

/*
 * Check that 'emit' args are inferred correctly
 */
{
	// @ts-expect-error
	emitter.emit('someEvent', 'NOT VALID');
	emitter.emit('someEvent', { name: 'jack' });

	// @ts-expect-error
	emitter.emit('foo');
	// @ts-expect-error
	emitter.emit('foo', 1);
	emitter.emit('foo', 'string');

	emitter.emit('bar');
	emitter.emit('bar', 1);
	// @ts-expect-error
	emitter.emit('bar', 'string');
}

/*
 * Listening to multiple events distributes union of events
 */
{
	emitter.on(['foo', 'bar'], ({ type, event }) => {
		if (type === 'foo') {
			event satisfies string;
		} else if (type === 'bar') {
			event satisfies number | undefined;
		}
	});
}

/**
 * Listening to all events distributes union of all events
 */
{
	emitter.on('*', ({ type, event }) => {
		if (type === 'foo') {
			event satisfies string;
		} else if (type === 'bar') {
			event satisfies number | undefined;
		} else if (type === 'someEvent') {
			event satisfies SomeEventData;
		}
	});
}
