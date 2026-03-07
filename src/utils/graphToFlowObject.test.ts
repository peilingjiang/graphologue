import dagre from 'dagre'

import { EdgeEntity, NodeEntity, OriginRange } from '../App'
import { answerObjectsToReactFlowObject } from './graphToFlowObject'

const createOriginRange = (
  answerObjectId: string,
  nodeIds: string[],
): OriginRange => ({
  start: 0,
  end: 1,
  answerObjectId,
  nodeIds,
})

const createNodeEntity = (id: string, label = id): NodeEntity => ({
  id,
  displayNodeLabel: label,
  pseudo: false,
  individuals: [
    {
      id,
      nodeLabel: label,
      originRange: createOriginRange('answer-1', [id]),
      originText: label,
    },
  ],
})

const createEdgeEntity = (
  edgeLabel: string,
  sourceId: string,
  targetId: string,
  saliency: 'high' | 'low' = 'high',
): EdgeEntity => ({
  edgeLabel,
  edgePairs: [{ saliency, sourceId, targetId }],
  originRange: createOriginRange('answer-1', [sourceId, targetId]),
  originText: `${sourceId}-${edgeLabel}-${targetId}`,
})

describe('answerObjectsToReactFlowObject', () => {
  test('keeps the labeled highest-saliency edge for a node pair', () => {
    const nodeEntities = [
      createNodeEntity('$N1', 'Bird'),
      createNodeEntity('$N2', 'Sky'),
    ]
    const edgeEntities = [
      createEdgeEntity('', '$N1', '$N2', 'low'),
      createEdgeEntity('flies through', '$N1', '$N2', 'high'),
      createEdgeEntity('', '$N1', '$N2', 'high'),
    ]

    const result = answerObjectsToReactFlowObject(
      new dagre.graphlib.Graph(),
      nodeEntities,
      edgeEntities,
      {
        answerObjectIdsHighlighted: [],
        answerObjectIdsHighlightedTemp: [],
        answerObjectIdsHidden: [],
        highlightedCoReferenceOriginRanges: [],
        highlightedNodeIdsProcessing: [],
        saliencyFilter: 'low',
      },
      [],
    )

    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].data?.label).toBe('flies through')
  })

  test('removes descendants of collapsed nodes from the rendered graph', () => {
    const nodeEntities = [
      createNodeEntity('$N1', 'Root'),
      createNodeEntity('$N2', 'Branch'),
      createNodeEntity('$N3', 'Leaf'),
    ]
    const edgeEntities = [
      createEdgeEntity('contains', '$N1', '$N2'),
      createEdgeEntity('contains', '$N2', '$N3'),
    ]

    const result = answerObjectsToReactFlowObject(
      new dagre.graphlib.Graph(),
      nodeEntities,
      edgeEntities,
      {
        answerObjectIdsHighlighted: [],
        answerObjectIdsHighlightedTemp: [],
        answerObjectIdsHidden: [],
        highlightedCoReferenceOriginRanges: [],
        highlightedNodeIdsProcessing: [],
        saliencyFilter: 'low',
      },
      ['$N2'],
    )

    expect(result.nodes.map(node => node.id)).toEqual(['$N1', '$N2'])
    expect(result.edges.map(edge => `${edge.source}->${edge.target}`)).toEqual([
      '$N1->$N2',
    ])
  })
})
