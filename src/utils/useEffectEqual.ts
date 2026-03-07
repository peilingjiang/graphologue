import { DependencyList, EffectCallback, useEffect, useRef } from 'react'
import isEqual from 'react-fast-compare'

export const useEffectEqual = (
  effect: EffectCallback,
  deps: DependencyList,
) => {
  const prevDepsRef = useRef<DependencyList>()
  const effectRef = useRef(effect)
  const effectVersionRef = useRef(0)

  effectRef.current = effect

  if (!isEqual(prevDepsRef.current, deps)) {
    prevDepsRef.current = deps
    effectVersionRef.current += 1
  }

  const effectVersion = effectVersionRef.current

  useEffect(() => effectRef.current(), [effectVersion])
}
