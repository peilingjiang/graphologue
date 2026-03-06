import { debug, userProvidedAPIKey } from '../constants'

export const globalBestModelAvailable = 'gpt-5.4'

export type ModelForMagic = 'gpt-5.4' | 'gpt-4-1106-preview' | 'gpt-3.5-turbo'

export const models = {
  smarter: globalBestModelAvailable as ModelForMagic,
  faster: globalBestModelAvailable as ModelForMagic,
}

const openAIResponsesEndpoint = 'https://api.openai.com/v1/responses'

const temperatures = {
  response: 0.7,
  parsing: 0.3,
}

interface OpenAIResponsesOutputContent {
  type?: string
  text?: string
}

interface OpenAIResponsesOutputItem {
  type?: string
  content?: OpenAIResponsesOutputContent[]
}

export interface OpenAIResponseStreamEvent {
  type: string
  delta?: string
}

export interface OpenAIRequestError {
  ok: false
  error: {
    status?: number
    statusText?: string
    message: string
    body?: any
  }
}

export interface OpenAIStreamSuccess {
  ok: true
}

export type OpenAIStreamResult = OpenAIStreamSuccess | OpenAIRequestError

export interface Prompt {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const getOpenAIAPIKey = (
  userInputKey = userProvidedAPIKey.current,
  envKey = process.env.REACT_APP_OPENAI_API_KEY,
  isDebug = debug,
): string | null => {
  const trimmedUserInputKey = userInputKey?.trim()
  if (trimmedUserInputKey) return trimmedUserInputKey

  const trimmedEnvKey = envKey?.trim()
  if (isDebug && trimmedEnvKey) return trimmedEnvKey

  return null
}

export const getCompletionOptions = (
  prompts: Prompt[],
  model: ModelForMagic,
  temperature: number | undefined,
  token: number | undefined,
  stream = false,
) => {
  return {
    model,
    input: prompts,
    temperature,
    max_output_tokens: token,
    stream,
  }
}

const getRequestOptions = (options: any) => {
  const apiKey = getOpenAIAPIKey()

  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(options),
  }
}

const getErrorResult = async (
  response: Response,
): Promise<OpenAIRequestError> => {
  let body: any = null

  try {
    body = await response.json()
  } catch (error) {}

  return {
    ok: false,
    error: {
      status: response.status,
      statusText: response.statusText,
      message:
        body?.error?.message ??
        body?.message ??
        `${response.status} ${response.statusText}`,
      body,
    },
  }
}

const extractTextFromResponsesOutput = (
  output: OpenAIResponsesOutputItem[] | undefined,
): string => {
  if (!output?.length) return ''

  return output
    .flatMap(item => item.content ?? [])
    .map(contentItem => contentItem.text ?? '')
    .join('')
}

export const getOpenAICompletion = async (
  prompts: Prompt[],
  model: ModelForMagic,
  temperature = temperatures.response,
  token = 1024,
) => {
  console.log(`asking ${model}`, prompts)

  const options = getCompletionOptions(prompts, model, temperature, token)
  const requestOptions = getRequestOptions(options)

  const response = await fetch(openAIResponsesEndpoint, requestOptions)

  if (!response.ok) return getErrorResult(response)

  const data = await response.json()

  return data
}

export const streamOpenAICompletion = async (
  prompts: Prompt[],
  model: ModelForMagic,
  streamFunction: (data: any, freshStream: boolean) => void,
  freshStream: boolean,
  temperature = temperatures.response,
  token = 2048,
): Promise<OpenAIStreamResult> => {
  console.log(`streaming ${model}`, prompts)

  const options = getCompletionOptions(prompts, model, temperature, token, true)
  const requestOptions = getRequestOptions(options)

  const response = await fetch(openAIResponsesEndpoint, requestOptions)

  if (!response.ok) return getErrorResult(response)

  const reader = response.body?.getReader()
  if (!reader)
    return {
      ok: false,
      error: {
        message: 'OpenAI returned an empty streaming response.',
      },
    } as OpenAIRequestError

  let bufferedChunk = ''
  const decoder = new TextDecoder('utf-8')

  const flushStreamEvents = (complete = false) => {
    bufferedChunk = bufferedChunk.replace(/\r\n/g, '\n')
    if (complete && !bufferedChunk.endsWith('\n\n')) bufferedChunk += '\n\n'

    let separatorIndex = bufferedChunk.indexOf('\n\n')
    while (separatorIndex >= 0) {
      const rawEvent = bufferedChunk.slice(0, separatorIndex).trim()
      bufferedChunk = bufferedChunk.slice(separatorIndex + 2)

      if (rawEvent.length > 0) {
        const data = rawEvent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('data:'))
          .map(line => line.replace(/^data:\s?/, ''))
          .join('\n')
          .trim()

        if (data && data !== '[DONE]') {
          try {
            const dataObject = JSON.parse(data) as OpenAIResponseStreamEvent
            if (dataObject.type === 'response.output_text.delta')
              streamFunction(dataObject, freshStream)
          } catch (error) {}
        }
      }

      separatorIndex = bufferedChunk.indexOf('\n\n')
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    bufferedChunk += decoder.decode(value, { stream: true })
    flushStreamEvents()
  }

  flushStreamEvents(true)

  return { ok: true }
}

/* -------------------------------------------------------------------------- */

export const parseOpenAIResponseToObjects = async (
  prompts: Prompt[],
  model: ModelForMagic,
  temperature = temperatures.parsing,
  token = 2048,
) => {
  console.log(`parsing ${model}`, prompts)

  const options = getCompletionOptions(
    prompts,
    model,
    temperature,
    token,
    false,
  )
  const requestOptions = getRequestOptions(options)

  try {
    const response = await fetch(openAIResponsesEndpoint, requestOptions)

    if (!response.ok) return getErrorResult(response)

    const data = await response.json()

    return data
  } catch (error) {
    return {
      error: error,
    }
  }
}

/* -------------------------------------------------------------------------- */

export const getTextFromModelResponse = (response: any): string => {
  if (response.error) return ''

  if (typeof response.output_text === 'string') return response.output_text

  if (response.choices?.[0]?.message?.content)
    return response.choices[0].message.content ?? ''

  return extractTextFromResponsesOutput(response.output)
}

export const getTextFromStreamResponse = (
  response: OpenAIResponseStreamEvent | any,
): string => {
  if (response.type === 'response.output_text.delta')
    return response.delta ?? ''
  return response.choices?.[0]?.delta?.content ?? ''
}
