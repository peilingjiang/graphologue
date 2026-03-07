import {
  AutoCameraController,
  autoCameraDuration,
  getAutoCameraAnimationProgress,
  getAutoCameraFitViewOptions,
  getAutoCameraNextViewport,
  isAutoCameraViewportSettled,
} from './autoCamera'

describe('AutoCameraController', () => {
  test('keeps only the latest pending request until nodes are initialized', () => {
    const controller = new AutoCameraController()

    controller.request(['$N1', '$N2'])
    controller.request(['$N1', '$N2', '$N3'])

    expect(controller.consume(false)).toBeNull()
    expect(controller.consume(true)).toEqual({
      nodeIds: ['$N1', '$N2', '$N3'],
    })
    expect(controller.consume(true)).toBeNull()
  })

  test('clears pending work while paused and accepts new work after resume', () => {
    const controller = new AutoCameraController()

    controller.request(['$N1'])
    controller.pause()
    controller.request(['$N1', '$N2'])

    expect(controller.consume(true)).toBeNull()

    controller.resume()
    controller.request(['$N1', '$N2'])

    expect(controller.consume(true)).toEqual({
      nodeIds: ['$N1', '$N2'],
    })
  })
})

describe('getAutoCameraFitViewOptions', () => {
  test('targets the provided nodes with the passive camera duration', () => {
    expect(getAutoCameraFitViewOptions(['$N1', '$N2'])).toEqual(
      expect.objectContaining({
        duration: autoCameraDuration,
        nodes: [{ id: '$N1' }, { id: '$N2' }],
      }),
    )
  })
})

describe('auto camera viewport smoothing', () => {
  test('uses a fixed eased duration for camera motion', () => {
    expect(getAutoCameraAnimationProgress(100, 100)).toBe(0)
    expect(getAutoCameraAnimationProgress(100, 400)).toBeCloseTo(0.707, 3)
    expect(getAutoCameraAnimationProgress(100, 100 + autoCameraDuration)).toBe(
      1,
    )
  })

  test('moves partway toward the target viewport based on eased progress', () => {
    expect(
      getAutoCameraNextViewport(
        { x: 0, y: 0, zoom: 1 },
        { x: 100, y: 50, zoom: 0.5 },
        0.5,
      ),
    ).toEqual(
      expect.objectContaining({
        x: 50,
        y: 25,
        zoom: 0.75,
      }),
    )
  })

  test('snaps to the target viewport once it is close enough', () => {
    const targetViewport = { x: 100, y: 50, zoom: 0.5 }

    expect(
      isAutoCameraViewportSettled(
        { x: 99.5, y: 49.3, zoom: 0.501 },
        targetViewport,
      ),
    ).toBe(true)

    expect(
      getAutoCameraNextViewport(
        { x: 99.5, y: 49.3, zoom: 0.501 },
        targetViewport,
        0.1,
      ),
    ).toEqual(targetViewport)
  })
})
