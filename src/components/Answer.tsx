import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { PuffLoader } from 'react-spinners'

import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded'
import ShortTextRoundedIcon from '@mui/icons-material/ShortTextRounded'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'

import { QuestionAndAnswer, RawAnswerRange } from '../App'
import ReactFlowComponent from '../componentsFlow/ReactFlowComponent'
import { rangeToId } from '../utils/chatAppUtils'
import { InterchangeContext } from './Interchange'

export const Answer = () => {
  const { data: questionAndAnswer } = useContext(InterchangeContext)
  const {
    id,
    modelStatus: { modelAnsweringComplete, modelParsingComplete },
  } = questionAndAnswer

  return (
    <div className="answer-wrapper">
      {/* 1 */}
      <RawAnswer
        key={`raw-answer-${id}`}
        questionAndAnswer={questionAndAnswer}
      />

      {/* <div className="answer-item-height answer-item interchange-component">
        {answer}
      </div> */}

      {/* 2 */}
      {/* <SlideAnswer /> */}

      {/* 3 */}
      {modelAnsweringComplete && modelParsingComplete ? (
        <>
          <ReactFlowComponent key={`react-flow-${id}`} />
        </>
      ) : modelAnsweringComplete ? (
        <div className="react-flow-loading-placeholder">
          <PuffLoader size={32} color="#57068c" />
        </div>
      ) : (
        <></>
      )}
    </div>
  )
}

const RawAnswer = ({
  questionAndAnswer: {
    answer,
    answerInformation,
    highlighted,
    modelStatus: { modelAnsweringComplete },
  },
}: {
  questionAndAnswer: QuestionAndAnswer
}) => {
  const [blockDisplay, setBlockDisplay] = useState(false)
  const [summaryDisplay, setSummaryDisplay] = useState(false)

  const canSwitchBlockDisplay =
    modelAnsweringComplete && answerInformation.length > 0

  const switchedToBlockDisplay = useRef(false)
  useEffect(() => {
    if (canSwitchBlockDisplay && !switchedToBlockDisplay.current) {
      switchedToBlockDisplay.current = true
      setBlockDisplay(true)
    }
  }, [canSwitchBlockDisplay])

  /* -------------------------------------------------------------------------- */

  const handleSwitchBlockDisplay = useCallback(() => {
    setSummaryDisplay(false)
    setBlockDisplay(prev => !prev)
  }, [])

  const handleSwitchSummaryDisplay = useCallback(() => {
    setSummaryDisplay(prev => !prev)
  }, [])

  return (
    <div
      className={`answer-item-display${
        modelAnsweringComplete ? ' answer-side' : ' answer-centered'
      }`}
    >
      {canSwitchBlockDisplay && (
        <div className="block-display-switches">
          <button className="bar-button" onClick={handleSwitchBlockDisplay}>
            {/* {blockDisplay ? <ViewColumnRoundedIcon style={{
              transform: 'rotate(90deg)'
            }} /> : <NotesRoundedIcon />} */}
            <VerticalSplitRoundedIcon />
            {blockDisplay ? <span>list</span> : <span>paragraph</span>}
          </button>
          <button
            disabled={
              !blockDisplay ||
              !answerInformation.some(a => a.summary.length > 0)
            }
            className="bar-button"
            onClick={handleSwitchSummaryDisplay}
          >
            {summaryDisplay ? <ShortTextRoundedIcon /> : <NotesRoundedIcon />}
            {summaryDisplay ? <span>summary</span> : <span>original</span>}
          </button>
        </div>
      )}
      {blockDisplay ? (
        <div className={`answer-block-list`}>
          {answerInformation.map((answerObject, index) => {
            return (
              <div
                key={rangeToId(answerObject.origin)}
                className={`answer-item interchange-component${
                  index !== 0 ? ' drop-down' : ''
                }`}
              >
                {summaryDisplay ? (
                  answerObject.summary
                ) : (
                  <AnswerText
                    rawAnswer={answer}
                    highlightedRanges={highlighted.origins}
                    slicingRange={answerObject.origin}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className={`answer-item interchange-component`}>
          <AnswerText
            rawAnswer={answer}
            highlightedRanges={highlighted.origins}
            slicingRange={{
              start: 0,
              end: answer.length - 1,
            }}
          />
        </div>
      )}
    </div>
  )
}

const AnswerText = ({
  rawAnswer,
  highlightedRanges,
  slicingRange,
}: {
  rawAnswer: string
  highlightedRanges: RawAnswerRange[]
  slicingRange: RawAnswerRange
}) => {
  const displayText = rawAnswer.slice(slicingRange.start, slicingRange.end + 1)

  highlightedRanges.sort((a, b) => a.start - b.start)

  // remove the highlighted ranges that are not in the slicing range
  const filteredHighlightedRanges = highlightedRanges.filter(
    range => !(range.end < slicingRange.start || range.start > slicingRange.end)
  )

  if (filteredHighlightedRanges.length === 0) {
    return <span className="answer-text">{displayText}</span>
  }

  const textComponents: JSX.Element[] = [] // array of <span> or <span className="highlighted">
  let browsedStartingIndex = slicingRange.start

  filteredHighlightedRanges.forEach((range, index) => {
    if (range.start > browsedStartingIndex) {
      // add the text before the highlighted range
      textComponents.push(
        <span key={`${rangeToId(range)}-before`} className="answer-text">
          {rawAnswer.slice(browsedStartingIndex, range.start)}
        </span>
      )
    }

    // add the highlighted range
    textComponents.push(
      <span
        key={`${rangeToId(range)}-highlighted`}
        className="answer-text highlighted-answer-text"
      >
        {rawAnswer.slice(range.start, range.end + 1)}
      </span>
    )

    browsedStartingIndex = range.end + 1

    if (
      index === filteredHighlightedRanges.length - 1 &&
      slicingRange.end > range.end
    ) {
      // add the text after the last highlighted range
      textComponents.push(
        <span key={`${rangeToId(range)}-after`} className="answer-text">
          {rawAnswer.slice(browsedStartingIndex, slicingRange.end + 1)}
        </span>
      )
    }
  })

  return <>{textComponents}</>
}
