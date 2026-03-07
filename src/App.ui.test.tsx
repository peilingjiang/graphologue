import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ChatApp } from './App'

jest.mock('./components/Interchange', () => {
  const React = require('react')
  const { ChatContext } = require('./components/Contexts')

  return {
    Interchange: ({ data }: { data: { id: string } }) => {
      const { setQuestionsAndAnswers } = React.useContext(ChatContext)

      return (
        <div data-testid="interchange" data-id={data.id}>
          <button
            onClick={() => {
              setQuestionsAndAnswers((prev: any[]) =>
                prev.map(item =>
                  item.id === data.id
                    ? {
                        ...item,
                        answer: item.answer || 'Answered',
                      }
                    : item,
                ),
              )
            }}
          >
            answer
          </button>
        </div>
      )
    },
  }
})

describe('ChatApp', () => {
  test('adds exactly one trailing blank interchange after an answer appears in Strict Mode', async () => {
    const { container } = render(
      <React.StrictMode>
        <ChatApp />
      </React.StrictMode>,
    )

    fireEvent.change(
      screen.getByPlaceholderText(/paste your openai api key here/i),
      {
        target: { value: 'sk-test-key' },
      },
    )

    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1])

    await waitFor(() => {
      expect(screen.getAllByTestId('interchange')).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'answer' }))

    await waitFor(() => {
      expect(screen.getAllByTestId('interchange')).toHaveLength(2)
    })
  })
})
