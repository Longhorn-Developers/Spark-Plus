import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { getRequestLogData, logger, withNotFound, withOnError } from '@repo/hono-helpers'

import type { Context } from 'hono'
import type { App } from './context'

type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

const app = new Hono<App>()

app
	.use('*', (c, next) =>
		useWorkersLogger(c.env.NAME, {
			environment: c.env.ENVIRONMENT,
			release: c.env.SENTRY_RELEASE,
		})(c, next)
	)
	.onError(withOnError())
	.notFound(withNotFound())

const getOperands = (url: URL): { a: number; b: number } | null => {
	const aParam = url.searchParams.get('a')
	const bParam = url.searchParams.get('b')

	if (aParam === null || bParam === null) {
		return null
	}

	const a = Number(aParam)
	const b = Number(bParam)

	if (Number.isNaN(a) || Number.isNaN(b)) {
		return null
	}

	return { a, b }
}

const calculate = (operation: Operation, a: number, b: number): number | null => {
	switch (operation) {
		case 'add':
			return a + b
		case 'subtract':
			return a - b
		case 'multiply':
			return a * b
		case 'divide':
			if (b === 0) {
				return null
			}
			return a / b
		default:
			return null
	}
}

const handleOperation = (operation: Operation) => async (c: Context<App>) => {
	const url = new URL(c.req.url)

	// we can also access env variables via
	// import { env } from 'cloudflare:workers'
	logger.info(`release: ${env.SENTRY_RELEASE}`)

	const operands = getOperands(url)
	if (!operands) {
		return c.json(
			{
				error: 'Both query parameters "a" and "b" must be present and valid numbers.',
			},
			400
		)
	}

	const result = calculate(operation, operands.a, operands.b)
	if (result === null) {
		return c.json(
			{
				error: operation === 'divide' ? 'Cannot divide by zero.' : 'Unable to perform calculation.',
			},
			400
		)
	}

	const response = {
		operation,
		a: operands.a,
		b: operands.b,
		result,
	}

	logger
		.withTags({
			type: 'calculator_request',
			operation,
			calculator_host: url.hostname,
		})
		.info(`calculator request: ${url}`, {
			data: JSON.stringify(response),
			request: getRequestLogData(c, Date.now()),
		})

	return c.json(response)
}

app.get('/add', handleOperation('add'))
app.get('/subtract', handleOperation('subtract'))
app.get('/multiply', handleOperation('multiply'))
app.get('/divide', handleOperation('divide'))

export default app
