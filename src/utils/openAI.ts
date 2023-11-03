import { exampleStreamData } from '../components/streamData'
import { debug, userProvidedAPIKey } from '../constants'
import { sleep } from './utils'

export type ModelForMagic = 'gpt-4' | 'gpt-3.5-turbo'

export const models = {
  smarter: 'gpt-4' as ModelForMagic,
  faster: 'gpt-4' as ModelForMagic,
  // faster: 'gpt-3.5-turbo' as ModelForMagic,
}

const temperatures = {
  response: 0.7,
  parsing: 0.3,
}

export interface OpenAIChatCompletionResponseStream {
  id: string
  object: string
  created: number
  model: string
  choices: {
    delta: {
      content?: string
      role?: string
    }
  }[]
  index: number
  finish_reason: string
}

export interface Prompt {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const getCompletionOptions = (
  prompts: Prompt[],
  model: ModelForMagic,
  temperature: number | undefined,
  token: number | undefined,
  stream = false,
) => {
  return {
    messages: prompts,
    ////
    model: model,
    temperature: temperature,
    max_tokens: token,
    n: 1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: stream,
  }
}

const getRequestOptions = (options: any) => {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:
        'Bearer ' +
        String(
          debug
            ? process.env.REACT_APP_OPENAI_API_KEY
            : userProvidedAPIKey.current,
        ),
    },
    body: JSON.stringify(options),
  }
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

  const response = await fetch(
    'https://api.openai.com/v1/chat/completions',
    requestOptions,
  )

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
) => {
  console.log(`streaming ${model}`, prompts)

  const options = getCompletionOptions(prompts, model, temperature, token, true)
  const requestOptions = getRequestOptions(options)

  const newStreamData = JSON.parse(JSON.stringify(exampleStreamData))

  let shortWaitStarted = false

  while (newStreamData.length) {
    const data = newStreamData.shift()
    if (!data) continue

    if (data.start_short_wait) {
      shortWaitStarted = true
    }

    if (data.end_short_wait) {
      shortWaitStarted = false
    }

    // if data only has symbols
    if (shortWaitStarted) {
      await sleep(50)
    } else {
      if (data.long_wait !== undefined) await sleep(data.long_wait)
      else if (textOnlyHasSymbols(getTextFromStreamResponse(data)))
        await sleep(40)
      else await sleep(95)
    }

    streamFunction(data, freshStream)
  }

  /* const response = await fetch(
    'https://api.openai.com/v1/chat/completions',
    requestOptions,
  )

  const reader = response.body?.getReader()
  if (!reader) return

  const dataParticle = {
    current: '',
  }
  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    const data = new TextDecoder('utf-8').decode(value)
    // response format
    // data: { ... }

    const dataObjects = data
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0)
    dataObjects.forEach(d => {
      d = d.replace(/^data: /, '').trim()
      if (d === '[DONE]') return

      let parsingSuccessful = false
      try {
        const dataObject = JSON.parse(d) as OpenAIChatCompletionResponseStream

        if (
          dataObject.choices?.length > 0 &&
          dataObject.choices[0].delta.content
        )
          streamFunction(dataObject, freshStream)

        parsingSuccessful = true
        dataParticle.current = ''
      } catch (error) {
        parsingSuccessful = false
        dataParticle.current += d
        // console.error('stream error', error, data)
      }

      if (!parsingSuccessful) {
        // try parsing dataParticle
        try {
          const dataObject = JSON.parse(
            dataParticle.current,
          ) as OpenAIChatCompletionResponseStream

          if (
            dataObject.choices?.length > 0 &&
            dataObject.choices[0].delta.content
          )
            streamFunction(dataObject, freshStream)

          dataParticle.current = ''
        } catch (error) {}
      }
    })
  }

  return */
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
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      requestOptions,
    )

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
  return response.choices[0].message.content
}

export const getTextFromStreamResponse = (
  response: OpenAIChatCompletionResponseStream,
): string => {
  return response.choices[0].delta.content ?? ''
}

const textOnlyHasSymbols = (text: string) => {
  return !text.match(/[a-z0-9]/i)
}
