import {
  applyTextReplacements,
  helpSetQuestionAndAnswer,
  newAnswerObject,
  newQuestionAndAnswer,
} from './chatUtils'

describe('chat utils', () => {
  test('applies every text replacement against the latest accumulated text', () => {
    expect(
      applyTextReplacements('Alpha sentence. Beta sentence.', [
        {
          target: 'Beta sentence.',
          replacement: 'Beta fixed.',
        },
        {
          target: 'Alpha sentence.',
          replacement: 'Alpha fixed.',
        },
      ]),
    ).toBe('Alpha fixed. Beta fixed.')
  })

  test('keeps untouched answer objects referentially stable', () => {
    const answerObject = {
      ...newAnswerObject(),
      originText: {
        content: 'Original answer',
        nodeEntities: [],
        edgeEntities: [],
      },
    }
    const existingQuestionAndAnswer = newQuestionAndAnswer({
      id: 'question-1',
      question: 'Before',
      answerObjects: [answerObject],
    })

    const updatedQuestionsAndAnswers = helpSetQuestionAndAnswer(
      [existingQuestionAndAnswer],
      'question-1',
      {
        question: 'After',
      },
    )

    expect(updatedQuestionsAndAnswers[0].answerObjects).toBe(
      existingQuestionAndAnswer.answerObjects,
    )
  })

  test('defensively copies incoming answer objects before storing them', () => {
    const existingQuestionAndAnswer = newQuestionAndAnswer({
      id: 'question-1',
    })
    const workingAnswerObject = {
      ...newAnswerObject(),
      originText: {
        content: 'Working copy',
        nodeEntities: [],
        edgeEntities: [],
      },
      answerObjectSynced: {
        listDisplay: 'original' as const,
        saliencyFilter: 'high' as const,
        collapsedNodes: ['node-1'],
        sentencesBeingCorrected: [],
      },
    }

    const updatedQuestionsAndAnswers = helpSetQuestionAndAnswer(
      [existingQuestionAndAnswer],
      'question-1',
      {
        answerObjects: [workingAnswerObject],
      },
    )

    workingAnswerObject.originText.content = 'Mutated outside React state'
    workingAnswerObject.answerObjectSynced.collapsedNodes.push('node-2')

    expect(
      updatedQuestionsAndAnswers[0].answerObjects[0].originText.content,
    ).toBe('Working copy')
    expect(
      updatedQuestionsAndAnswers[0].answerObjects[0].answerObjectSynced
        .collapsedNodes,
    ).toEqual(['node-1'])
  })
})
