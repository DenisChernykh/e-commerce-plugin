import type { z } from "zod";

export type Environment = { CATALOG_API_URL?: string; STORE_URL?: string };
export type BackendFetch = typeof fetch;
export const DEFAULT_API = "https://tiho-api.tiho-backend.workers.dev";
export const DEFAULT_STORE = "https://tiho-store.vercel.app";

export class CatalogError extends Error {
  constructor(
    message: string,
    public code = "BACKEND_UNAVAILABLE",
    public status = 502,
  ) {
    super(message);
  }
}
export function createBackendClient(env: Environment, fetchBackend: BackendFetch) {
  const base = new URL(env.CATALOG_API_URL || DEFAULT_API);
  const store = new URL(env.STORE_URL || DEFAULT_STORE);
  for (const url of [base, store]) {
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      throw new CatalogError("Некорректный адрес сервиса.", "CONFIGURATION_ERROR", 500);
  }
  return {
    store,
    async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
      let response: Response;
      try {
        response = await fetchBackend(new URL(path, base), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
          redirect: "manual",
        });
      } catch {
        throw new CatalogError(
          "Каталог временно недоступен. Повторите запрос; это не пустая подборка.",
        );
      }
      if (!response.ok) {
        if (response.status === 404)
          throw new CatalogError(
            "Товар не найден. Проверьте ID или выберите другой товар.",
            "NOT_FOUND",
            404,
          );
        if (response.status === 400)
          throw new CatalogError(
            "Параметры не приняты каталогом. Проверьте значения фильтров.",
            "INVALID_PARAMETERS",
            400,
          );
        throw new CatalogError(
          "Не удалось прочитать каталог. Повторите позже; наличие товаров неизвестно.",
        );
      }
      try {
        return schema.parse(await response.json());
      } catch {
        throw new CatalogError(
          "Ответ каталога не соответствует контракту. Данные не показаны.",
          "INVALID_BACKEND_RESPONSE",
        );
      }
    },
  };
}
