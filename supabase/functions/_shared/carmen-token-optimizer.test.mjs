import assert from 'node:assert/strict'

function keywordRankToolNames(queryText, toolDefs, limit = 40) {
  const terms = String(queryText || '').toLocaleLowerCase('he').split(/[^\p{L}\p{N}_]+/u).filter((t) => t.length >= 2)
  if (!terms.length) return []
  return toolDefs
    .map((t) => {
      const name = t.name.toLowerCase()
      const hay = `${name} ${(t.description || '').toLocaleLowerCase('he')}`
      let score = 0
      for (const term of terms) {
        if (name.includes(term)) score += 4
        else if (hay.includes(term)) score += 1
      }
      return { name: t.name, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.name)
}

function fuseRankedToolNames(rankedLists, k = 60) {
  const scores = new Map()
  for (const list of rankedLists) {
    list.forEach((name, idx) => {
      scores.set(name, (scores.get(name) || 0) + 1 / (k + idx + 1))
    })
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

function compactToolDefinition(tool) {
  const desc = String(tool.description || tool.name).replace(/\s+/g, ' ').trim()
  return {
    name: tool.name,
    description: desc.slice(0, 120),
    parameters: { type: 'object', properties: {} },
  }
}

const tools = [
  { name: 'create_task', description: 'יצירת משימה לצוות' },
  { name: 'list_clients', description: 'רשימת לקוחות' },
  { name: 'inspect_facebook_ad', description: 'בדיקת מודעת פייסבוק' },
  { name: 'get_latest_campaign_pulse', description: 'בדיקת דופק קמפיינים' },
]

const kw = keywordRankToolNames('בדיקת דופק קמפיינים', tools, 10)
assert.ok(kw.includes('get_latest_campaign_pulse'))

const fused = fuseRankedToolNames([
  ['inspect_facebook_ad', 'create_task'],
  ['create_task', 'list_clients'],
])
assert.equal(fused[0], 'create_task')

const compact = compactToolDefinition(tools[0])
assert.deepEqual(compact.parameters, { type: 'object', properties: {} })

console.log('carmen-token-optimizer.test.mjs: ok')
