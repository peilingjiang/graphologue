import React from 'react'

import { QuestionAndAnswer } from '../App'
import { Answer } from './Answer'
import { Question } from './Question'

export interface InterchangeProps {
  data: QuestionAndAnswer
}

export const Interchange = ({
  data,
  data: { question, answer },
}: InterchangeProps) => {
  return (
    <div className="interchange-item">
      <Question questionAndAnswer={data} />
      {answer.length > 0 && <Answer questionAndAnswer={data} />}
    </div>
  )
}