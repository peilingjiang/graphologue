import React, { Suspense, lazy } from 'react'

import { AnswerSlideObject } from '../App'

const LazyReactMarkdown = lazy(() => import('react-markdown'))

export const SlideAnswerText = ({ content }: AnswerSlideObject) => {
  return (
    <Suspense fallback={<div className="slide-text-wrapper">{content}</div>}>
      <div className="slide-text-wrapper">
        <LazyReactMarkdown>{content}</LazyReactMarkdown>
      </div>
    </Suspense>
  )
}
