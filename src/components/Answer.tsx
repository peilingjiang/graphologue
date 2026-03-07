import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  getNodesBounds,
  getViewportForBounds,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  Viewport,
} from 'reactflow'
import dagre from 'dagre'
import { PuffLoader } from 'react-spinners'

import ShortTextRoundedIcon from '@mui/icons-material/ShortTextRounded'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'
import CropLandscapeRoundedIcon from '@mui/icons-material/CropLandscapeRounded'
import HorizontalSplitRoundedIcon from '@mui/icons-material/HorizontalSplitRounded'
import RectangleRoundedIcon from '@mui/icons-material/RectangleRounded'
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded'
import MoneyOffRoundedIcon from '@mui/icons-material/MoneyOffRounded'
import SubjectRoundedIcon from '@mui/icons-material/SubjectRounded'
////
import SignalWifi1BarRoundedIcon from '@mui/icons-material/SignalWifi1BarRounded'
import SignalWifi4BarRoundedIcon from '@mui/icons-material/SignalWifi4BarRounded'

import {
  QuestionAndAnswer,
  OriginRange,
  AnswerObject,
  EdgeEntity,
  AnswerObjectEntitiesTarget,
  DebugModeContext,
} from '../App'
import ReactFlowComponent from '../componentsFlow/ReactFlowComponent'
import { InterchangeContext } from './Interchange'
import { SlideAnswerText } from './SlideAnswer'
import { useEffectEqual } from '../utils/useEffectEqual'
import { answerObjectsToReactFlowObject } from '../utils/graphToFlowObject'
import {
  getRangeFromStart,
  mergeEdgeEntities,
  mergeNodeEntities,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeAnnotations,
  splitAnnotatedSentences,
} from '../utils/responseProcessing'
import {
  AutoCameraController,
  autoCameraDuration,
  autoCameraMaxZoom,
  autoCameraMinZoom,
  getAutoCameraAnimationProgress,
  getAutoCameraNextViewport,
  getAutoCameraPadding,
  isAutoCameraViewportSettled,
} from '../utils/autoCamera'
import { makeFlowTransition } from '../utils/flowChangingTransition'

export interface ReactFlowObjectContextProps {
  // nodeEntities: NodeEntity[]
  // edgeEntities: EdgeEntity[]
  answerObjectId: string
  generatingFlow: boolean
}

export const ReactFlowObjectContext =
  createContext<ReactFlowObjectContextProps>({
    // nodeEntities: [],
    // edgeEntities: [],
    answerObjectId: '',
    generatingFlow: false,
  })

////
export interface AnswerBlockContextProps {
  handleOrganizeNodes: () => void
  handleViewportMoveStart: (event?: MouseEvent | TouchEvent) => void
  resumeAutoCamera: () => void
  runProgrammaticViewportMove: (fn: () => void, duration?: number) => void
}

export const AnswerBlockContext = createContext<AnswerBlockContextProps>(
  {} as AnswerBlockContextProps,
)

export const Answer = () => {
  const { questionAndAnswer } = useContext(InterchangeContext)
  const { id } = questionAndAnswer as QuestionAndAnswer

  return (
    <div className="answer-wrapper" data-id={id}>
      <AnswerListView
        key={`raw-answer-${id}`}
        questionAndAnswer={questionAndAnswer}
      />
    </div>
  )
}

export type ListDisplayFormat = 'original' | 'summary' | 'slide'
export type DiagramDisplayFormat = 'split' | 'merged'

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

interface AnswerListContextProps {
  // synced: QuestionAndAnswerSynced
  handleHighlightAnswerObject: (
    answerObjectId: string,
    addOrRemove: 'add' | 'remove',
    temp: boolean,
  ) => void
  handleHideAnswerObject: (answerObjectId: string) => void
  handleAnswerObjectSwitchListDisplayFormat: (
    answerObjectId: string,
    newDisplay: ListDisplayFormat,
  ) => void
  handleAnswerObjectRemove: (answerObjectId: string) => void
}
const AnswerListContext = createContext<AnswerListContextProps>(
  {} as AnswerListContextProps,
)

const AnswerListView = ({
  questionAndAnswer,
  questionAndAnswer: {
    id,
    answer,
    answerObjects,
    synced,
    synced: { saliencyFilter },
    modelStatus: { modelParsingComplete },
  },
}: {
  questionAndAnswer: QuestionAndAnswer
}) => {
  const { debugMode, setDebugMode } = useContext(DebugModeContext)

  const {
    handleAnswerObjectSwitchListDisplayFormat,
    handleSetSyncedAnswerObjectIdsHighlighted,
    handleSetSyncedAnswerObjectIdsHidden,
    // handleAnswerObjectTellLessOrMore,
    handleAnswerObjectRemove,
    handleSwitchSaliency,
  } = useContext(InterchangeContext)

  const [diagramDisplay, setDiagramDisplay] =
    useState<DiagramDisplayFormat>('split')

  /* -------------------------------------------------------------------------- */

  const handleSwitchDiagramDisplay = useCallback(
    (newDisplayFormat: DiagramDisplayFormat) => {
      setDiagramDisplay(newDisplayFormat)

      // remove all highlighted and hidden answer objects if switching to split
      if (newDisplayFormat === 'split') {
        handleSetSyncedAnswerObjectIdsHighlighted([], false)
        handleSetSyncedAnswerObjectIdsHidden([])
      }

      // smoothly scroll .answer-text with data-id === answerObjectId into view
      const answerObjectElement = document.querySelector(
        `.answer-wrapper[data-id="${id}"]`,
      )
      if (answerObjectElement) {
        answerObjectElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    },
    [
      handleSetSyncedAnswerObjectIdsHidden,
      handleSetSyncedAnswerObjectIdsHighlighted,
      id,
    ],
  )

  const handleSwitchSaliencyFilter = useCallback(() => {
    makeFlowTransition()
    handleSwitchSaliency()
  }, [handleSwitchSaliency])

  // const handleSwitchDebug = useCallback(() => {}, [])

  const handleHighlightAnswerObject = useCallback(
    (answerObjectId: string, addOrRemove: 'add' | 'remove', temp: boolean) => {
      const currentIds = temp
        ? synced.answerObjectIdsHighlightedTemp
        : synced.answerObjectIdsHighlighted

      if (addOrRemove === 'remove') {
        if (temp) handleSetSyncedAnswerObjectIdsHighlighted([], true)
        else
          handleSetSyncedAnswerObjectIdsHighlighted(
            currentIds.filter(id => id !== answerObjectId),
            false,
          )
      } else {
        if (temp)
          handleSetSyncedAnswerObjectIdsHighlighted([answerObjectId], true)
        else
          handleSetSyncedAnswerObjectIdsHighlighted(
            [...currentIds, answerObjectId],
            temp,
          )
      }
    },
    [
      handleSetSyncedAnswerObjectIdsHighlighted,
      synced.answerObjectIdsHighlighted,
      synced.answerObjectIdsHighlightedTemp,
    ],
  )

  const handleHideAnswerObject = useCallback(
    (answerObjectId: string) => {
      const currentIds = synced.answerObjectIdsHidden

      if (currentIds.includes(answerObjectId)) {
        handleSetSyncedAnswerObjectIdsHidden(
          currentIds.filter(id => id !== answerObjectId),
        )
      } else
        handleSetSyncedAnswerObjectIdsHidden([...currentIds, answerObjectId])
    },
    [handleSetSyncedAnswerObjectIdsHidden, synced.answerObjectIdsHidden],
  )

  const primaryMergedAnswerObject = answerObjects[0]

  return (
    <AnswerListContext.Provider
      value={{
        handleHighlightAnswerObject,
        handleHideAnswerObject,
        handleAnswerObjectSwitchListDisplayFormat,
        handleAnswerObjectRemove,
      }}
    >
      <div
        // className={`answer-item-display${
        //   modelAnsweringComplete ? ' answer-side' : ' answer-centered'
        // }`}
        className={`answer-item-display`}
        data-id={id}
      >
        <div className="block-display-switches">
          {/* <button
          // disabled={!canSwitchBlockDisplay}
          className="bar-button"
          onClick={handleSwitchBlockDisplay}
        >
          <VerticalSplitRoundedIcon />
        </button> */}

          <div className="list-display-switch">
            <button
              // disabled={!blockDisplay}
              className={`bar-button${
                diagramDisplay === 'split' ? ' selected' : ''
              }`}
              onClick={() => handleSwitchDiagramDisplay('split')}
            >
              <HorizontalSplitRoundedIcon />
              <span>split diagram</span>
            </button>
            <button
              className={`bar-button${
                diagramDisplay === 'merged' ? ' selected' : ''
              }`}
              onClick={() => handleSwitchDiagramDisplay('merged')}
            >
              <RectangleRoundedIcon />
              <span>merged diagram</span>
            </button>
          </div>

          <button
            className={`bar-button`}
            onClick={() => handleSwitchSaliencyFilter()}
          >
            {saliencyFilter === 'high' ? (
              <SignalWifi1BarRoundedIcon
                style={{
                  transform: 'rotate(180deg)',
                }}
              />
            ) : (
              <SignalWifi4BarRoundedIcon
                style={{
                  transform: 'rotate(180deg)',
                }}
              />
            )}
            <span>saliency</span>
          </button>
          <button
            className={`bar-button`}
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? <AttachMoneyRoundedIcon /> : <MoneyOffRoundedIcon />}
            {/* <span>{debugMode ? '[annotation ($N1)]' : 'annotation'}</span> */}
            <span>annotation</span>
          </button>
        </div>

        {/* display in block */}

        <div
          className={`answer-block-list${
            diagramDisplay === 'merged' ? '-merged-diagram' : ''
          }`}
          data-id={id}
        >
          {/* ! MAP */}
          {diagramDisplay === 'merged' ? (
            <>
              <div className="answer-text-block-list">
                {answerObjects.map((answerObject, index) => (
                  <AnswerTextBlock
                    key={`answer-block-item-${id}-${answerObject.id}`}
                    index={index}
                    questionAndAnswer={questionAndAnswer}
                    answerObject={answerObject}
                    diagramDisplay={diagramDisplay}
                    lastTextBlock={index === answerObjects.length - 1}
                  />
                ))}
              </div>
              {primaryMergedAnswerObject && (
                <ReactFlowProvider
                  key={`answer-block-flow-provider-${id}-${primaryMergedAnswerObject.id}`}
                >
                  <AnswerBlockItem
                    key={`answer-block-item-${id}-${primaryMergedAnswerObject.id}`}
                    index={0}
                    questionAndAnswer={questionAndAnswer}
                    answerObject={primaryMergedAnswerObject}
                    diagramDisplay={diagramDisplay}
                    lastTextBlock={false}
                  />
                </ReactFlowProvider>
              )}
            </>
          ) : (
            answerObjects.map((answerObject, index) => (
              <ReactFlowProvider
                key={`answer-block-flow-provider-${id}-${answerObject.id}`}
              >
                <AnswerBlockItem
                  key={`answer-block-item-${id}-${answerObject.id}`}
                  index={index}
                  questionAndAnswer={questionAndAnswer}
                  answerObject={answerObject}
                  diagramDisplay={diagramDisplay}
                  lastTextBlock={index === answerObjects.length - 1}
                />
              </ReactFlowProvider>
            ))
          )}
        </div>
      </div>
    </AnswerListContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */

export const AnswerBlockItem = ({
  index,
  questionAndAnswer,
  questionAndAnswer: {
    id,
    answerObjects,
    modelStatus: { modelParsingComplete },
    synced,
    synced: { answerObjectIdsHidden, saliencyFilter },
  },
  answerObject,
  diagramDisplay,
  lastTextBlock,
}: {
  index: number
  questionAndAnswer: QuestionAndAnswer
  answerObject: AnswerObject
  diagramDisplay: DiagramDisplayFormat
  lastTextBlock: boolean
}) => {
  /* -------------------------------------------------------------------------- */
  const isForMergedDiagram = diagramDisplay === 'merged'
  const useSummary = answerObject.answerObjectSynced.listDisplay === 'summary'

  const {
    getNodes,
    getViewport,
    setNodes,
    setEdges,
    setViewport,
    viewportInitialized,
  } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  const answerBlockRef = useRef<HTMLDivElement | null>(null)
  const stableDagreGraph = useRef(new dagre.graphlib.Graph())
  const autoCameraController = useRef(new AutoCameraController())
  const autoCameraFrame = useRef<number | null>(null)
  const autoCameraAnimationStartViewport = useRef<Viewport | null>(null)
  const autoCameraAnimationStartedAt = useRef<number | null>(null)
  const autoCameraTargetViewport = useRef<Viewport | null>(null)
  const autoCameraMoveCleanup = useRef<(() => void) | null>(null)
  const programmaticViewportMoves = useRef(0)
  const programmaticViewportTimeouts = useRef<number[]>([])
  const [autoCameraVersion, setAutoCameraVersion] = useState(0)

  useEffect(() => {
    stableDagreGraph.current = new dagre.graphlib.Graph()
  }, [useSummary, saliencyFilter, answerObjectIdsHidden])

  useEffect(() => {
    autoCameraController.current.resume()
  }, [])

  useEffect(() => {
    return () => {
      if (autoCameraFrame.current !== null) {
        window.cancelAnimationFrame(autoCameraFrame.current)
      }

      autoCameraMoveCleanup.current?.()
      autoCameraMoveCleanup.current = null

      programmaticViewportTimeouts.current.forEach(timeoutId => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  // ! put all node and edge entities together
  // const nodeEntities = mergeNodeEntities(answerObjects, answerObjectIdsHidden)
  // const edgeEntities = mergeEdgeEntities(answerObjects, answerObjectIdsHidden)
  const nodeEntities = useMemo(() => {
    if (isForMergedDiagram)
      return mergeNodeEntities(answerObjects, answerObjectIdsHidden)

    return useSummary
      ? answerObject.summary.nodeEntities
      : answerObject.originText.nodeEntities
  }, [
    answerObject,
    answerObjectIdsHidden,
    answerObjects,
    isForMergedDiagram,
    useSummary,
  ])

  const edgeEntities: EdgeEntity[] = useMemo(() => {
    if (isForMergedDiagram)
      return mergeEdgeEntities(answerObjects, answerObjectIdsHidden)

    return useSummary
      ? answerObject.summary.edgeEntities
      : answerObject.originText.edgeEntities
  }, [
    answerObject,
    answerObjectIdsHidden,
    answerObjects,
    isForMergedDiagram,
    useSummary,
  ])

  const queueAutoCamera = useCallback((nodeIds: string[]) => {
    autoCameraController.current.request(nodeIds)
    setAutoCameraVersion(version => version + 1)
  }, [])

  const resumeAutoCamera = useCallback(() => {
    autoCameraController.current.resume()
    setAutoCameraVersion(version => version + 1)
  }, [])

  const beginProgrammaticViewportMove = useCallback(() => {
    programmaticViewportMoves.current += 1

    let released = false

    return () => {
      if (released) return

      released = true
      programmaticViewportMoves.current = Math.max(
        0,
        programmaticViewportMoves.current - 1,
      )
    }
  }, [])

  const runProgrammaticViewportMove = useCallback(
    (fn: () => void, duration = autoCameraDuration) => {
      const releaseProgrammaticMove = beginProgrammaticViewportMove()
      fn()

      const timeoutId = window.setTimeout(() => {
        releaseProgrammaticMove()
        programmaticViewportTimeouts.current =
          programmaticViewportTimeouts.current.filter(id => id !== timeoutId)
      }, duration + 50)

      programmaticViewportTimeouts.current.push(timeoutId)
    },
    [beginProgrammaticViewportMove],
  )

  const stopAutoCameraAnimation = useCallback(() => {
    if (autoCameraFrame.current !== null) {
      window.cancelAnimationFrame(autoCameraFrame.current)
      autoCameraFrame.current = null
    }

    autoCameraAnimationStartViewport.current = null
    autoCameraAnimationStartedAt.current = null
    autoCameraTargetViewport.current = null
    autoCameraMoveCleanup.current?.()
    autoCameraMoveCleanup.current = null
  }, [])

  const getAutoCameraTargetViewport = useCallback(
    (nodeIds: string[]) => {
      const flowWrapperElement = answerBlockRef.current?.querySelector(
        '.react-flow-wrapper',
      ) as HTMLElement | null
      if (!flowWrapperElement) return null

      const { width, height } = flowWrapperElement.getBoundingClientRect()
      if (!width || !height) return null

      const requestedNodeIds = new Set(nodeIds)
      const targetNodes = getNodes().filter(node =>
        requestedNodeIds.has(node.id),
      )
      if (!targetNodes.length) return null

      const nodeBounds = getNodesBounds(targetNodes)

      return getViewportForBounds(
        nodeBounds,
        width,
        height,
        autoCameraMinZoom,
        autoCameraMaxZoom,
        getAutoCameraPadding(),
      )
    },
    [getNodes],
  )

  const startAutoCameraAnimation = useCallback(() => {
    if (autoCameraFrame.current !== null) return
    if (!autoCameraTargetViewport.current) return

    if (!autoCameraMoveCleanup.current) {
      autoCameraMoveCleanup.current = beginProgrammaticViewportMove()
    }

    const advanceViewport = (timestamp: number) => {
      const targetViewport = autoCameraTargetViewport.current
      const startViewport = autoCameraAnimationStartViewport.current
      const startedAt = autoCameraAnimationStartedAt.current
      if (!targetViewport) {
        stopAutoCameraAnimation()
        return
      }

      if (!startViewport || startedAt === null) {
        stopAutoCameraAnimation()
        return
      }

      const nextViewport = getAutoCameraNextViewport(
        startViewport,
        targetViewport,
        getAutoCameraAnimationProgress(startedAt, timestamp),
      )

      setViewport(nextViewport)

      if (
        isAutoCameraViewportSettled(nextViewport, targetViewport) &&
        autoCameraTargetViewport.current === targetViewport
      ) {
        setViewport(targetViewport)
        stopAutoCameraAnimation()
        return
      }

      autoCameraFrame.current = window.requestAnimationFrame(advanceViewport)
    }

    autoCameraFrame.current = window.requestAnimationFrame(advanceViewport)
  }, [beginProgrammaticViewportMove, setViewport, stopAutoCameraAnimation])

  const handleViewportMoveStart = useCallback(
    (event?: MouseEvent | TouchEvent) => {
      if (event?.isTrusted && autoCameraFrame.current !== null) {
        stopAutoCameraAnimation()
      }

      if (programmaticViewportMoves.current > 0 && !event?.isTrusted) return

      stopAutoCameraAnimation()
      autoCameraController.current.pause()
      setAutoCameraVersion(version => version + 1)
    },
    [stopAutoCameraAnimation],
  )

  const syncReactFlowGraph = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = answerObjectsToReactFlowObject(
      stableDagreGraph.current,
      nodeEntities,
      edgeEntities,
      synced,
      answerObject.answerObjectSynced.collapsedNodes,
    )

    setNodes(newNodes)
    setEdges(newEdges)
    queueAutoCamera(newNodes.map(node => node.id))
  }, [
    answerObject.answerObjectSynced.collapsedNodes,
    edgeEntities,
    nodeEntities,
    queueAutoCamera,
    setEdges,
    setNodes,
    synced,
  ])

  useEffectEqual(() => {
    syncReactFlowGraph()
  }, [
    // we don't care about individuals
    // nodeEntities.map(nE =>
    //   (({ id, displayNodeLabel, pseudo }) => ({
    //     id,
    //     displayNodeLabel,
    //     pseudo,
    //   }))(nE)
    // ),
    // nodeEntities.length,
    nodeEntities,
    edgeEntities,
    // ! should we add this?
    // synced, // ???
    synced.saliencyFilter,
    synced.answerObjectIdsHidden,
    // synced.highlightedCoReferenceOriginRanges,
    answerObject.answerObjectSynced.collapsedNodes,
    syncReactFlowGraph,
  ])

  useEffect(() => {
    const autoCameraRequest = autoCameraController.current.consume(
      nodesInitialized && viewportInitialized,
    )
    if (!autoCameraRequest) return

    autoCameraTargetViewport.current = getAutoCameraTargetViewport(
      autoCameraRequest.nodeIds,
    )
    if (!autoCameraTargetViewport.current) return

    autoCameraAnimationStartViewport.current = getViewport()
    autoCameraAnimationStartedAt.current = performance.now()

    startAutoCameraAnimation()
  }, [
    autoCameraVersion,
    getViewport,
    getAutoCameraTargetViewport,
    nodesInitialized,
    startAutoCameraAnimation,
    viewportInitialized,
  ])

  const handleOrganizeNodes = useCallback(() => {
    resumeAutoCamera()
    syncReactFlowGraph()
  }, [resumeAutoCamera, syncReactFlowGraph])

  /* -------------------------------------------------------------------------- */

  return (
    <AnswerBlockContext.Provider
      value={{
        handleOrganizeNodes,
        handleViewportMoveStart,
        resumeAutoCamera,
        runProgrammaticViewportMove,
      }}
    >
      <div
        ref={answerBlockRef}
        className={`answer-block-item-wrapper${
          isForMergedDiagram ? ' merged-diagram-wrapper' : ''
        }`}
      >
        {!isForMergedDiagram && (
          <AnswerTextBlock
            index={index}
            questionAndAnswer={questionAndAnswer}
            answerObject={answerObject}
            diagramDisplay={diagramDisplay}
            lastTextBlock={lastTextBlock}
          />
        )}

        <ReactFlowObjectContext.Provider
          value={{
            answerObjectId: answerObject.id,
            generatingFlow: isForMergedDiagram
              ? !modelParsingComplete
              : !answerObject.complete,
          }}
        >
          <ReactFlowComponent
            key={`react-flow-${id}-${answerObject.id}`}
            id={`${id}-${answerObject.id}`}
          />
        </ReactFlowObjectContext.Provider>
      </div>
    </AnswerBlockContext.Provider>
  )
}

const AnswerTextBlock = ({
  index,
  questionAndAnswer: {
    modelStatus: { modelParsingComplete },
    synced,
  },
  answerObject,
  diagramDisplay,
  lastTextBlock,
}: {
  index: number
  questionAndAnswer: QuestionAndAnswer
  answerObject: AnswerObject
  diagramDisplay: DiagramDisplayFormat
  lastTextBlock: boolean
}) => {
  const { handleAnswerObjectTellLessOrMore, handleAnswerObjectsAddOneMore } =
    useContext(InterchangeContext)
  const {
    handleHighlightAnswerObject,
    handleHideAnswerObject,
    handleAnswerObjectSwitchListDisplayFormat,
    // handleAnswerObjectRemove,
  } = useContext(AnswerListContext)

  const answerObjectComplete = answerObject.complete

  const answerObjectHighlightedActually =
    synced.answerObjectIdsHighlighted.includes(answerObject.id)
  const answerObjectHighlighted =
    synced.answerObjectIdsHighlighted.includes(answerObject.id) ||
    synced.answerObjectIdsHighlightedTemp.includes(answerObject.id)

  const answerObjectHidden = synced.answerObjectIdsHidden.includes(
    answerObject.id,
  )

  const listDisplay = answerObject.answerObjectSynced.listDisplay
  const diagramMerged = diagramDisplay === 'merged'

  const loadingComponent = (
    <div className="answer-loading-placeholder">
      <PuffLoader size={32} color="#57068c" />
    </div>
  )

  const contentComponent =
    listDisplay === 'summary' ? (
      answerObject.summary.content.length ? (
        <AnswerText
          answerObject={answerObject}
          rawAnswer={answerObject.summary.content}
          entitiesTarget="summary"
          highlightedRanges={synced.highlightedCoReferenceOriginRanges}
        />
      ) : (
        loadingComponent
      )
    ) : listDisplay === 'slide' ? (
      answerObject.slide.content.length ? (
        <SlideAnswerText content={answerObject.slide.content} />
      ) : (
        loadingComponent
      )
    ) : (
      <AnswerText
        answerObject={answerObject}
        rawAnswer={answerObject.originText.content}
        entitiesTarget="originText"
        highlightedRanges={synced.highlightedCoReferenceOriginRanges}
      />
    )

  return (
    <div className="answer-item-wrapper">
      <div
        key={`answer-range-${answerObject.id}`}
        className={`answer-item answer-item-block interchange-component${
          index !== 0 ? (diagramMerged ? ' drop-up-answer' : ' drop-down') : ''
        }${listDisplay === 'slide' ? ' slide-wrapper' : ''}${
          answerObjectHighlighted && diagramMerged ? ' highlighted-item' : ''
        }`}
        onMouseEnter={() => {
          if (diagramMerged && !answerObjectHidden)
            handleHighlightAnswerObject(answerObject.id, 'add', true)
        }}
        onMouseLeave={() => {
          if (diagramMerged && !answerObjectHidden)
            handleHighlightAnswerObject(answerObject.id, 'remove', true)
        }}
      >
        <div className="answer-block-menu">
          <span
            className={`answer-block-menu-item${
              listDisplay === 'original' ? ' highlighted-list-display' : ''
            }`}
            onClick={() => {
              handleAnswerObjectSwitchListDisplayFormat(
                answerObject.id,
                'original',
              )
            }}
          >
            <NotesRoundedIcon />
            original
          </span>
          <span
            className={`answer-block-menu-item${
              listDisplay === 'slide' ? ' highlighted-list-display' : ''
            }${
              answerObjectComplete && modelParsingComplete ? '' : ' disabled'
            }`}
            onClick={() => {
              handleAnswerObjectSwitchListDisplayFormat(
                answerObject.id,
                'slide',
              )
            }}
          >
            <CropLandscapeRoundedIcon />
            outline
          </span>
          <span
            className={`answer-block-menu-item${
              listDisplay === 'summary' ? ' highlighted-list-display' : ''
            }${
              answerObjectComplete && modelParsingComplete ? '' : ' disabled'
            }`}
            onClick={() => {
              handleAnswerObjectSwitchListDisplayFormat(
                answerObject.id,
                'summary',
              )
            }}
          >
            <ShortTextRoundedIcon />
            summary
          </span>

          <span className="answer-block-menu-item-divider">|</span>

          <span
            className={`answer-block-menu-item${
              answerObjectHighlightedActually ? ' highlighted' : ''
            }${!answerObjectComplete || !diagramMerged ? ' disabled' : ''}`}
            onClick={() => {
              handleHighlightAnswerObject(
                answerObject.id,
                answerObjectHighlightedActually ? 'remove' : 'add',
                false,
              )
            }}
          >
            highlight
          </span>
          <span
            className={`answer-block-menu-item${
              answerObjectHidden ? ' hidden' : ''
            }${!answerObjectComplete || !diagramMerged ? ' disabled' : ''}`}
            onClick={() => {
              handleHideAnswerObject(answerObject.id)
            }}
          >
            hide
          </span>
          {/* <span
          className={`answer-block-menu-item`}
          onClick={() => {
            handleAnswerObjectRemove(answerObject.id)
          }}
        >
          remove
        </span> */}
        </div>
        <div className="answer-item-text">{contentComponent}</div>
        {/* {answerObjectComplete && ( */}
        {/* )} */}
        <div className="tell-me-more-wrapper">
          <span
            className={`tell-me-more${
              answerObjectComplete && modelParsingComplete ? '' : ' disabled'
            }`}
            onClick={() => {
              handleAnswerObjectTellLessOrMore(answerObject.id, 'more')
            }}
          >
            tell me more...
          </span>
        </div>
      </div>
      {lastTextBlock && (
        <div
          className={`add-paragraph${
            answerObjectComplete && modelParsingComplete ? '' : ' disabled'
          }`}
          onClick={() => handleAnswerObjectsAddOneMore()}
        >
          <SubjectRoundedIcon />
          <span>add a paragraph</span>
        </div>
      )}
    </div>
  )
}

const AnswerText = ({
  answerObject,
  rawAnswer,
  entitiesTarget,
  highlightedRanges,
}: {
  answerObject: AnswerObject
  rawAnswer: string
  entitiesTarget: AnswerObjectEntitiesTarget
  highlightedRanges: OriginRange[]
}) => {
  const { debugMode } = useContext(DebugModeContext)
  const { handleSetSyncedCoReferenceOriginRanges } =
    useContext(InterchangeContext)

  // const displayText = removeAnnotations(
  //   rawAnswer.slice(slicingRange.start, slicingRange.end + 1)
  // )
  // const text = rawAnswer.slice(slicingRange.start, slicingRange.end + 1)
  const text = rawAnswer
  const sentences = splitAnnotatedSentences(text)

  const prevSyncedList = useRef<OriginRange[]>([])

  const handleHoverAnnotatedTextSegment = useCallback(
    (start: number) => {
      const range = getRangeFromStart(
        start,
        answerObject[entitiesTarget].nodeEntities,
        answerObject[entitiesTarget].edgeEntities,
      )

      if (range) {
        prevSyncedList.current = highlightedRanges.map(r => ({
          ...r,
          nodeIds: [...r.nodeIds],
        }))
        const newRanges = [...new Set([...highlightedRanges, range])]
        handleSetSyncedCoReferenceOriginRanges(newRanges)
      }
    },
    [
      answerObject,
      entitiesTarget,
      handleSetSyncedCoReferenceOriginRanges,
      highlightedRanges,
    ],
  )

  const handleLeaveAnnotatedTextSegment = useCallback(() => {
    handleSetSyncedCoReferenceOriginRanges(prevSyncedList.current)
    prevSyncedList.current = []
  }, [handleSetSyncedCoReferenceOriginRanges])

  let globalStart = 0
  return (
    <div className="answer-text" data-id={answerObject.id}>
      {sentences.map((sentence, sentenceIndex) => (
        <span key={sentenceIndex} className="sentence-segment">
          {sentence.split(/(\[[^\]]+\])/).map((part, partIndex) => {
            const isAnnotated = part.startsWith('[') && part.endsWith(']')
            // const partNodeIds = isAnnotated ? getPartNodeIds(part) : []

            const start = globalStart
            globalStart += part.length

            // if (part === '\n') {
            //   globalStart += 1
            //   return <></>
            // }

            return (
              <span
                key={`${sentenceIndex}-${partIndex}`}
                className={
                  'text-segment' +
                  (isAnnotated ? ' annotated text-in' : '') +
                  (highlightedRanges.some(
                    ({
                      nodeIds: highlightedNodeIds,
                      start: highlightedStart,
                      answerObjectId: highlightedAnswerObjectId,
                    }) => {
                      // if ((part.match(/\$/g) || []).length > 1) return false
                      // node
                      if (highlightedNodeIds.length === 1) {
                        return (
                          (part.match(/\$/g) || []).length === 1 &&
                          highlightedNodeIds.some(highlightedNodeId =>
                            part.includes(`(${highlightedNodeId})`),
                          )
                        )
                      }

                      // edge
                      return (
                        answerObject.id === highlightedAnswerObjectId &&
                        start === highlightedStart
                      )
                    },
                  )
                    ? ' highlighted-answer-text'
                    : '')
                }
                data-start={start}
                ////
                onMouseEnter={() => {
                  handleHoverAnnotatedTextSegment(start)
                }}
                onMouseLeave={() => {
                  handleLeaveAnnotatedTextSegment()
                }}
              >
                {debugMode ? part : removeAnnotations(part)}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )
}
