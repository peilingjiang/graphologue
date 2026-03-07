import React from 'react'
import { act } from 'react'
import ReactDOM from 'react-dom/client'

import { DebugModeContext } from '../App'
import { InterchangeContext, InterchangeContextProps } from './Interchange'
import { Answer } from './Answer'
import { newQuestionAndAnswer } from '../utils/chatUtils'

describe('Answer', () => {
  test('does not crash when switching to merged mode before any answer objects exist', () => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true

    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)

    const interchangeContextValue: InterchangeContextProps = {
      questionAndAnswer: newQuestionAndAnswer({
        id: 'question-1',
        answerObjects: [],
      }),
      handleSelfCorrection: async () => '',
      handleSetSyncedAnswerObjectIdsHighlighted: () => {},
      handleSetSyncedAnswerObjectIdsHidden: () => {},
      handleSetSyncedCoReferenceOriginRanges: () => {},
      handleAnswerObjectRemove: () => {},
      handleAnswerObjectSwitchListDisplayFormat: () => {},
      handleAnswerObjectTellLessOrMore: () => {},
      handleAnswerObjectNodeExpand: () => {},
      handleAnswerObjectNodeRemove: () => {},
      handleAnswerObjectNodeCollapse: () => {},
      handleAnswerObjectNodeMerge: () => {},
      handleAnswerObjectsAddOneMore: () => {},
      handleSwitchSaliency: () => {},
    }

    act(() => {
      root.render(
        <DebugModeContext.Provider
          value={{
            debugMode: false,
            setDebugMode: () => {},
          }}
        >
          <InterchangeContext.Provider value={interchangeContextValue}>
            <Answer />
          </InterchangeContext.Provider>
        </DebugModeContext.Provider>,
      )
    })

    const mergedDiagramButton = Array.from(
      container.querySelectorAll('button'),
    ).find(button => button.textContent?.includes('merged diagram'))

    expect(mergedDiagramButton).toBeTruthy()

    expect(() => {
      act(() => {
        mergedDiagramButton?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
          }),
        )
      })
    }).not.toThrow()

    act(() => {
      root.unmount()
    })
  })
})
