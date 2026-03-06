import { TextDecoder, TextEncoder } from 'util'

import {
  getOpenAIAPIKey,
  getCompletionOptions,
  getTextFromModelResponse,
  getTextFromStreamResponse,
  Prompt,
  streamOpenAICompletion,
} from './openAI'

Object.assign(global, {
  TextDecoder,
  TextEncoder,
})

describe('openAI utils', () => {
  test('builds a Responses API request from prompts', () => {
    const prompts: Prompt[] = [
      {
        role: 'system',
        content: 'Follow the house style.',
      },
      {
        role: 'user',
        content: 'Summarize birds.',
      },
      {
        role: 'assistant',
        content: 'Birds can fly.',
      },
      {
        role: 'system',
        content: 'Keep it concise.',
      },
    ]

    expect(getCompletionOptions(prompts, 'gpt-5.4', 0.7, 512)).toEqual({
      model: 'gpt-5.4',
      input: prompts,
      temperature: 0.7,
      max_output_tokens: 512,
      stream: false,
    })
  })

  test('extracts text from a Responses API payload', () => {
    expect(
      getTextFromModelResponse({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Mapped response text',
              },
            ],
          },
        ],
      }),
    ).toBe('Mapped response text')
  })

  test('extracts delta text from a Responses API stream event', () => {
    expect(
      getTextFromStreamResponse({
        type: 'response.output_text.delta',
        delta: 'stream chunk',
      }),
    ).toBe('stream chunk')
  })

  test('prefers the key typed into the app over the dev env key', () => {
    expect(getOpenAIAPIKey('sk-user-input', 'sk-env-fallback', true)).toBe(
      'sk-user-input',
    )
  })

  test('streams deltas from split SSE chunks and flushes the trailing frame', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          const chunks = [
            'data: {"type":"response.output_text.d',
            'elta","delta":"Hello"}\r\n\r\n',
            'data: {"type":"response.output_text.delta","delta":" world"}',
          ]
          let index = 0

          return {
            read: async () => {
              if (index >= chunks.length) {
                return {
                  done: true,
                  value: undefined,
                }
              }

              const value = new TextEncoder().encode(chunks[index])
              index += 1

              return {
                done: false,
                value,
              }
            },
          }
        },
      },
    })

    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(fetchMock)
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {})
    const deltas: string[] = []

    try {
      await expect(
        streamOpenAICompletion(
          [
            {
              role: 'user',
              content: 'Say hello.',
            },
          ],
          'gpt-5.4',
          data => {
            deltas.push(getTextFromStreamResponse(data))
          },
          true,
        ),
      ).resolves.toEqual({ ok: true })

      expect(deltas).toEqual(['Hello', ' world'])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      fetchSpy.mockRestore()
      consoleLogSpy.mockRestore()
    }
  })
})
