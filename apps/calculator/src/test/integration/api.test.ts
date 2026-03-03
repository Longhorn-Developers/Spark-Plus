import { SELF } from 'cloudflare:test'
import { describe, expect, test } from 'vitest'

import '../../calculator.app'

describe('calculator worker', () => {
	test('adds two numbers', async () => {
		const res = await SELF.fetch('https://example.com/add?a=2&b=3')
		expect(res.status).toBe(200)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "a": 2,
			  "b": 3,
			  "operation": "add",
			  "result": 5,
			}
		`)
	})

	test('subtracts two numbers', async () => {
		const res = await SELF.fetch('https://example.com/subtract?a=5&b=2')
		expect(res.status).toBe(200)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "a": 5,
			  "b": 2,
			  "operation": "subtract",
			  "result": 3,
			}
		`)
	})

	test('multiplies two numbers', async () => {
		const res = await SELF.fetch('https://example.com/multiply?a=4&b=3')
		expect(res.status).toBe(200)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "a": 4,
			  "b": 3,
			  "operation": "multiply",
			  "result": 12,
			}
		`)
	})

	test('divides two numbers', async () => {
		const res = await SELF.fetch('https://example.com/divide?a=10&b=2')
		expect(res.status).toBe(200)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "a": 10,
			  "b": 2,
			  "operation": "divide",
			  "result": 5,
			}
		`)
	})

	test('returns 400 for missing parameters', async () => {
		const res = await SELF.fetch('https://example.com/add?a=2')
		expect(res.status).toBe(400)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "error": "Both query parameters \\"a\\" and \\"b\\" must be present and valid numbers.",
			}
		`)
	})

	test('returns 400 for division by zero', async () => {
		const res = await SELF.fetch('https://example.com/divide?a=10&b=0')
		expect(res.status).toBe(400)
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "error": "Cannot divide by zero.",
			}
		`)
	})
})
