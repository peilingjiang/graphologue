import { FitViewOptions, Viewport } from 'reactflow'

import { viewFittingPadding } from '../constants'

export const autoCameraDuration = 600
const autoCameraExtraPadding = 0.08
export const autoCameraMinZoom = 0.1
export const autoCameraMaxZoom = 1
const autoCameraPositionSettleDistance = 1
const autoCameraZoomSettleDistance = 0.002

export interface AutoCameraRequest {
  nodeIds: string[]
}

export class AutoCameraController {
  private paused = false
  private pendingRequest: AutoCameraRequest | null = null

  request(nodeIds: string[]) {
    if (this.paused || nodeIds.length === 0) return

    this.pendingRequest = {
      nodeIds: [...nodeIds],
    }
  }

  consume(nodesInitialized: boolean) {
    if (!nodesInitialized || this.paused || !this.pendingRequest) return null

    const request = this.pendingRequest
    this.pendingRequest = null

    return request
  }

  pause() {
    this.paused = true
    this.pendingRequest = null
  }

  resume() {
    this.paused = false
  }
}

export const getAutoCameraFitViewOptions = (
  nodeIds: string[],
): FitViewOptions => ({
  padding: viewFittingPadding + autoCameraExtraPadding,
  duration: autoCameraDuration,
  nodes: nodeIds.map(id => ({ id })),
})

export const getAutoCameraPadding = () =>
  viewFittingPadding + autoCameraExtraPadding

export const isAutoCameraViewportSettled = (
  currentViewport: Viewport,
  targetViewport: Viewport,
) =>
  Math.abs(currentViewport.x - targetViewport.x) <=
    autoCameraPositionSettleDistance &&
  Math.abs(currentViewport.y - targetViewport.y) <=
    autoCameraPositionSettleDistance &&
  Math.abs(currentViewport.zoom - targetViewport.zoom) <=
    autoCameraZoomSettleDistance

const easeAutoCameraProgress = (progress: number) =>
  Math.sin((progress * Math.PI) / 2)

export const getAutoCameraAnimationProgress = (
  startedAt: number,
  now: number,
) => {
  const rawProgress = (now - startedAt) / autoCameraDuration
  const clampedProgress = Math.min(Math.max(rawProgress, 0), 1)

  return easeAutoCameraProgress(clampedProgress)
}

export const getAutoCameraNextViewport = (
  startViewport: Viewport,
  targetViewport: Viewport,
  progress: number,
): Viewport => {
  if (
    progress >= 1 ||
    isAutoCameraViewportSettled(startViewport, targetViewport)
  ) {
    return targetViewport
  }

  const clampedProgress = Math.min(Math.max(progress, 0), 1)

  return {
    x: startViewport.x + (targetViewport.x - startViewport.x) * clampedProgress,
    y: startViewport.y + (targetViewport.y - startViewport.y) * clampedProgress,
    zoom:
      startViewport.zoom +
      (targetViewport.zoom - startViewport.zoom) * clampedProgress,
  }
}
