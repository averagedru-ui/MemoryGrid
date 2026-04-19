import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useStore } from '../store/useStore'

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  connections: number
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

export default function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { notes, links, setActiveNote } = useStore()

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = svgRef.current.clientWidth
    const h = svgRef.current.clientHeight

    const linkCount = new Map<string, number>()
    for (const l of links) {
      linkCount.set(l.source, (linkCount.get(l.source) ?? 0) + 1)
      linkCount.set(l.target, (linkCount.get(l.target) ?? 0) + 1)
    }

    const nodes: SimNode[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      connections: linkCount.get(n.id) ?? 0,
    }))

    const simLinks: SimLink[] = links.map((l) => ({ source: l.source, target: l.target }))

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 8]).on('zoom', (e) => {
      g.attr('transform', e.transform)
    })
    svg.call(zoom)

    const g = svg.append('g')

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => 8 + d.connections * 2))

    // Links
    const linkSel = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', '#7c6af7')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1)

    // Nodes
    const nodeSel = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => 5 + Math.sqrt(d.connections) * 2)
      .attr('fill', (_, i) => `hsl(${(i * 137.5) % 360}, 70%, 65%)`)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (_, d) => setActiveNote(d.id))
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // Labels
    const labelSel = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.title.slice(0, 24))
      .attr('font-size', 10)
      .attr('fill', '#9090a8')
      .attr('dy', (d) => -(7 + Math.sqrt(d.connections) * 2) - 2)
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none')

    sim.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)
      nodeSel.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)
      labelSel.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0)
    })

    return () => { sim.stop() }
  }, [notes, links, setActiveNote])

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" style={{ background: '#0d0d0f' }} />
      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted pointer-events-none">
          No notes yet — create some to see the graph
        </div>
      )}
    </div>
  )
}
