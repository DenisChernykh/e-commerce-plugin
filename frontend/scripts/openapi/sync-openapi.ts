import { mkdir, writeFile } from 'node:fs/promises'

const backendPath: string = '../../../backend/src/app/create-app.ts'
const { createApp } = (await import(backendPath)) as {
  createApp: () => { request: (url: string) => Promise<Response> }
}
const response = await createApp().request('http://openapi.local/openapi.json')
if (!response.ok) throw new Error(`OpenAPI returned ${response.status}`)
const document = await response.json()
for (const path of [
  '/api/products',
  '/api/categories',
  '/api/brands',
  '/api/catalog/facets',
]) {
  if (!document.paths[path]?.get?.operationId)
    throw new Error(`Missing operation for ${path}`)
}
await mkdir('openapi', { recursive: true })
await writeFile(
  'openapi/openapi.json',
  `${JSON.stringify(document, null, 2)}\n`,
)
console.log('OpenAPI synced from backend source')
