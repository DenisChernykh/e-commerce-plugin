import { defineConfig } from 'orval'

export default defineConfig({
  catalog: {
    input: { target: './openapi/openapi.json' },
    output: {
      target: './src/shared/api/generated/index.ts',
      schemas: './src/shared/api/generated/model',
      operationSchemas: './src/shared/api/generated/operation',
      client: 'react-query',
      httpClient: 'axios',
      mode: 'tags-split',
      clean: true,
      urlEncodeParameters: true,
      override: {
        mutator: {
          path: './src/shared/api/client/orval-mutator.ts',
          name: 'apiMutator',
        },
        useNamedParameters: true,
        useTypeOverInterfaces: true,
        enumGenerationType: 'union',
        query: { version: 5, signal: true },
      },
    },
  },
})
