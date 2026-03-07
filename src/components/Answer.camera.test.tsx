import React from 'react'
import { act } from 'react'
import ReactDOM from 'react-dom/client'
import dagre from 'dagre'
import { getNodesBounds, getViewportForBounds } from 'reactflow'

import { AnswerBlockItem, DiagramDisplayFormat } from './Answer'
import { newAnswerObject, newQuestionAndAnswer } from '../utils/chatUtils'
import { answerObjectsToReactFlowObject } from '../utils/graphToFlowObject'
import {
  autoCameraMaxZoom,
  autoCameraMinZoom,
  getAutoCameraPadding,
} from '../utils/autoCamera'
import { hardcodedNodeSize } from '../constants'
import { EdgeEntity, NodeEntity, OriginRange, QuestionAndAnswer } from '../App'

let mockReactFlowNodes: any[] = []
let mockViewport = { x: 0, y: 0, zoom: 1 }
const mockSetNodes = jest.fn()
const mockSetEdges = jest.fn()
const mockSetViewport = jest.fn()
let mockNodesInitialized = true

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow')
  const React = require('react')

  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useReactFlow: () => ({
      getNodes: () => mockReactFlowNodes,
      getViewport: () => mockViewport,
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setViewport: mockSetViewport,
      viewportInitialized: true,
    }),
    useNodesInitialized: () => mockNodesInitialized,
  }
})

jest.mock('../componentsFlow/ReactFlowComponent', () => ({
  __esModule: true,
  default: () => <div className="react-flow-wrapper" />,
}))

const createOriginRange = (
  answerObjectId: string,
  nodeIds: string[],
): OriginRange => ({
  start: 0,
  end: 1,
  answerObjectId,
  nodeIds,
})

const createNodeEntity = (id: string, label = id): NodeEntity => ({
  id,
  displayNodeLabel: label,
  pseudo: false,
  individuals: [
    {
      id,
      nodeLabel: label,
      originRange: createOriginRange('answer-1', [id]),
      originText: label,
    },
  ],
})

const createEdgeEntity = (sourceId: string, targetId: string): EdgeEntity => ({
  edgeLabel: 'relates to',
  edgePairs: [{ saliency: 'high', sourceId, targetId }],
  originRange: createOriginRange('answer-1', [sourceId, targetId]),
  originText: `${sourceId}-${targetId}`,
})

const createQuestionAndAnswer = (nodeIds: string[]): QuestionAndAnswer => {
  const answerObject = {
    ...newAnswerObject(),
    id: 'answer-1',
    originText: {
      content: nodeIds.join(', '),
      nodeEntities: nodeIds.map(nodeId => createNodeEntity(nodeId)),
      edgeEntities: nodeIds
        .slice(1)
        .map((nodeId, index) => createEdgeEntity(nodeIds[index], nodeId)),
    },
    summary: {
      content: '',
      nodeEntities: [],
      edgeEntities: [],
    },
    complete: false,
  }

  return newQuestionAndAnswer({
    id: 'question-1',
    answerObjects: [answerObject],
    modelStatus: {
      modelParsingComplete: false,
    },
    synced: {
      saliencyFilter: 'high',
    },
  })
}

describe('AnswerBlockItem camera', () => {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect
  const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame

  const getExpectedViewport = (questionAndAnswer: QuestionAndAnswer) => {
    const answerObject = questionAndAnswer.answerObjects[0]
    const { nodes } = answerObjectsToReactFlowObject(
      new dagre.graphlib.Graph(),
      answerObject.originText.nodeEntities,
      answerObject.originText.edgeEntities,
      questionAndAnswer.synced,
      answerObject.answerObjectSynced.collapsedNodes,
    )
    const measuredNodes = nodes.map(node => ({
      ...node,
      width: node.width ?? hardcodedNodeSize.width,
      height: node.height ?? hardcodedNodeSize.height,
    }))

    return getViewportForBounds(
      getNodesBounds(measuredNodes),
      2400,
      1400,
      autoCameraMinZoom,
      autoCameraMaxZoom,
      getAutoCameraPadding(),
    )
  }

  const expectViewportToMatch = (
    actualViewport: typeof mockViewport | undefined,
    expectedViewport: typeof mockViewport,
  ) => {
    expect(actualViewport).toBeDefined()
    if (!actualViewport) return

    expect(actualViewport.x).toBeCloseTo(expectedViewport.x, 3)
    expect(actualViewport.y).toBeCloseTo(expectedViewport.y, 3)
    expect(actualViewport.zoom).toBeCloseTo(expectedViewport.zoom, 3)
  }

  const flushCamera = () => {
    act(() => {})
    act(() => {
      jest.runAllTimers()
    })
  }

  const flushCameraFrame = () => {
    act(() => {})
    act(() => {
      jest.advanceTimersByTime(16)
    })
  }

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockSetNodes.mockReset()
    mockSetEdges.mockReset()
    mockSetViewport.mockReset()
    mockNodesInitialized = true
    mockReactFlowNodes = []
    mockViewport = { x: 0, y: 0, zoom: 1 }

    mockSetNodes.mockImplementation(payload => {
      const nextNodes =
        typeof payload === 'function' ? payload(mockReactFlowNodes) : payload

      mockReactFlowNodes = nextNodes.map((node: any) => ({
        ...node,
        width: node.width ?? hardcodedNodeSize.width,
        height: node.height ?? hardcodedNodeSize.height,
      }))
    })
    mockSetViewport.mockImplementation((viewport: typeof mockViewport) => {
      mockViewport = viewport
    })

    HTMLElement.prototype.getBoundingClientRect = jest.fn(() => ({
      x: 0,
      y: 0,
      width: 2400,
      height: 1400,
      top: 0,
      left: 0,
      right: 2400,
      bottom: 1400,
      toJSON: () => ({}),
    }))

    window.requestAnimationFrame = jest.fn(callback =>
      window.setTimeout(() => callback(performance.now()), 0),
    )
    window.cancelAnimationFrame = jest.fn(frameId => {
      window.clearTimeout(frameId)
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
  })

  afterAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  })

  test('fits the latest graph state after rapid node additions', () => {
    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)
    const diagramDisplay: DiagramDisplayFormat = 'merged'

    const initialQuestionAndAnswer = createQuestionAndAnswer(['$N1', '$N2'])
    const expandedQuestionAndAnswer = createQuestionAndAnswer([
      '$N1',
      '$N2',
      '$N3',
    ])

    const renderAnswerBlock = (questionAndAnswer: QuestionAndAnswer) => {
      const answerObject = questionAndAnswer.answerObjects[0]

      root.render(
        <AnswerBlockItem
          index={0}
          questionAndAnswer={questionAndAnswer}
          answerObject={answerObject}
          diagramDisplay={diagramDisplay}
          lastTextBlock={false}
        />,
      )
    }

    act(() => {
      renderAnswerBlock(initialQuestionAndAnswer)
    })
    act(() => {
      renderAnswerBlock(expandedQuestionAndAnswer)
    })
    flushCamera()

    expect(mockSetNodes).toHaveBeenCalled()
    expect(mockReactFlowNodes.length).toBeGreaterThan(0)

    expectViewportToMatch(
      mockSetViewport.mock.calls.at(-1)?.[0],
      getExpectedViewport(expandedQuestionAndAnswer),
    )

    act(() => {
      root.unmount()
    })
  })

  test('waits for measured nodes before fitting the latest graph', () => {
    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)
    const diagramDisplay: DiagramDisplayFormat = 'merged'
    const questionAndAnswer = createQuestionAndAnswer(['$N1', '$N2'])
    const answerObject = questionAndAnswer.answerObjects[0]

    mockNodesInitialized = false

    const renderAnswerBlock = () => {
      root.render(
        <AnswerBlockItem
          index={0}
          questionAndAnswer={questionAndAnswer}
          answerObject={answerObject}
          diagramDisplay={diagramDisplay}
          lastTextBlock={false}
        />,
      )
    }

    act(() => {
      renderAnswerBlock()
    })
    flushCamera()

    expect(mockSetViewport).not.toHaveBeenCalled()
    expect(mockSetNodes).toHaveBeenCalled()

    mockNodesInitialized = true

    act(() => {
      renderAnswerBlock()
    })
    flushCamera()

    expectViewportToMatch(
      mockSetViewport.mock.calls.at(-1)?.[0],
      getExpectedViewport(questionAndAnswer),
    )

    act(() => {
      root.unmount()
    })
  })

  test('redirects an in-flight camera animation to the latest graph target', () => {
    const container = document.createElement('div')
    const root = ReactDOM.createRoot(container)
    const diagramDisplay: DiagramDisplayFormat = 'merged'
    const initialQuestionAndAnswer = createQuestionAndAnswer(['$N1', '$N2'])
    const expandedQuestionAndAnswer = createQuestionAndAnswer([
      '$N1',
      '$N2',
      '$N3',
      '$N4',
    ])

    const renderAnswerBlock = (questionAndAnswer: QuestionAndAnswer) => {
      const answerObject = questionAndAnswer.answerObjects[0]

      root.render(
        <AnswerBlockItem
          index={0}
          questionAndAnswer={questionAndAnswer}
          answerObject={answerObject}
          diagramDisplay={diagramDisplay}
          lastTextBlock={false}
        />,
      )
    }

    act(() => {
      renderAnswerBlock(initialQuestionAndAnswer)
    })
    flushCameraFrame()

    const viewportDuringFirstAnimation = { ...mockViewport }

    act(() => {
      renderAnswerBlock(expandedQuestionAndAnswer)
    })
    flushCamera()

    const initialTargetViewport = getExpectedViewport(initialQuestionAndAnswer)

    expect(mockSetNodes).toHaveBeenCalled()
    expect(mockReactFlowNodes.length).toBeGreaterThan(0)

    expectViewportToMatch(
      mockSetViewport.mock.calls.at(-1)?.[0],
      getExpectedViewport(expandedQuestionAndAnswer),
    )
    expect(viewportDuringFirstAnimation.x).toBeLessThan(0)
    expect(viewportDuringFirstAnimation.x).toBeGreaterThan(
      initialTargetViewport.x,
    )
    expect(viewportDuringFirstAnimation.zoom).toBeLessThan(1)
    expect(viewportDuringFirstAnimation.zoom).toBeGreaterThan(
      initialTargetViewport.zoom,
    )
    expect(mockSetViewport.mock.calls.length).toBeGreaterThan(2)

    act(() => {
      root.unmount()
    })
  })
})
