import React from 'react'
import { act } from 'react'
import ReactDOM from 'react-dom/client'

import { useEffectEqual } from './useEffectEqual'

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

describe('useEffectEqual', () => {
  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  })

  test('runs on mount, skips deep-equal rerenders, and preserves cleanup behavior', () => {
    const observedValues: number[] = []
    const cleanedValues: number[] = []
    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)

    const Harness = ({ value }: { value: { count: number } }) => {
      useEffectEqual(() => {
        observedValues.push(value.count)

        return () => {
          cleanedValues.push(value.count)
        }
      }, [value])

      return null
    }

    act(() => {
      root.render(<Harness value={{ count: 1 }} />)
    })

    expect(observedValues).toEqual([1])
    expect(cleanedValues).toEqual([])

    act(() => {
      root.render(<Harness value={{ count: 1 }} />)
    })

    expect(observedValues).toEqual([1])
    expect(cleanedValues).toEqual([])

    act(() => {
      root.render(<Harness value={{ count: 2 }} />)
    })

    expect(observedValues).toEqual([1, 2])
    expect(cleanedValues).toEqual([1])

    act(() => {
      root.unmount()
    })

    expect(cleanedValues).toEqual([1, 2])
  })
})
