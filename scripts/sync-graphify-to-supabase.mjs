import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const graphPath = process.argv[2] || 'graphify-out/graph.json'
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

const graph = JSON.parse(await readFile(graphPath, 'utf8'))
const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
const links = Array.isArray(graph.links) ? graph.links : (Array.isArray(graph.edges) ? graph.edges : [])
const commit = graph.built_at_commit || process.env.GITHUB_SHA || 'unknown'
const version = `${commit}-${Date.now()}`
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function upsert(table, rows, conflict, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST', body: JSON.stringify(rows.slice(i, i + batchSize)),
    })
  }
}

await request('/rest/v1/aios_graph_versions', {
  method: 'POST',
  body: JSON.stringify({ version, commit_sha: commit, status: 'staging' }),
})

await upsert('aios_graph_nodes', nodes.map(n => ({
  version,
  id: String(n.id),
  label: String(n.label || n.id),
  file_type: n.file_type || null,
  source_file: n.source_file || null,
  source_location: n.source_location || null,
  community: Number.isInteger(n.community) ? n.community : null,
  community_name: n.community_name || null,
})), 'version,id')

await upsert('aios_graph_edges', links.map(e => {
  const source = String(e.source?.id ?? e.source)
  const target = String(e.target?.id ?? e.target)
  const relation = String(e.relation || 'related_to')
  const sourceFile = e.source_file || ''
  return {
    version,
    edge_key: createHash('sha256').update(`${source}\0${target}\0${relation}\0${sourceFile}`).digest('hex'),
    source_id: source,
    target_id: target,
    relation,
    confidence: e.confidence || null,
    confidence_score: Number.isFinite(e.confidence_score) ? e.confidence_score : null,
    source_file: e.source_file || null,
    source_location: e.source_location || null,
    weight: Number.isFinite(e.weight) ? e.weight : null,
  }
}), 'version,edge_key')

const activation = await request('/rest/v1/rpc/carmen_activate_system_graph', {
  method: 'POST',
  body: JSON.stringify({ p_version: version, p_expected_nodes: nodes.length, p_expected_edges: links.length }),
})

console.log(JSON.stringify({ ok: true, version, nodes: nodes.length, edges: links.length, activation }))

