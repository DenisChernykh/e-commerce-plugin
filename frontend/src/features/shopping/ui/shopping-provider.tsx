'use client'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createHttpShoppingClient } from '@/shared/api'
import { pollWhileVisible } from '@/shared/lib/visible-polling'
import {
  createShoppingController,
  type ShoppingController,
} from '../model/controller'
const Context = createContext<ShoppingController | null>(null)
export function ShoppingProvider({
  children,
  controller,
}: {
  children: ReactNode
  controller?: ShoppingController
}) {
  const [own] = useState(
    () => controller ?? createShoppingController(createHttpShoppingClient()),
  )
  useEffect(() => {
    if (location.pathname === '/connect') return
    return pollWhileVisible(own.refresh, 5000)
  }, [own])
  return <Context.Provider value={own}>{children}</Context.Provider>
}
export function useShopping() {
  const controller = useContext(Context)
  if (!controller) throw new Error('ShoppingProvider is required')
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  return { ...state, controller }
}
