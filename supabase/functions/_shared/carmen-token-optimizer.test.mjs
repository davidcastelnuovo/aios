import assert from 'node:assert/strict'

function shouldUseTokenOptimize(agent, isCarmen) {
  if (!isCarmen) return false
  if (agent?.metadata?.token_optimize === false) return false
  return true
}

function buildQuickAck(commandText) {
  const t = String(commandText || '').trim()
  if (!t) return 'קיבלתי, עובדת על זה.'
  if (t.length > 120) return 'קיבלתי את המשימה, עובדת עליה.'
  return `קיבלתי — "${t.slice(0, 80)}${t.length > 80 ? '…' : ''}"`
}

const MCP_KEYWORD_HINTS = {
  gmail: /gmail|אימייל|מייל|email/i,
}

function shouldLoadMcpConnection(connName, userText, forceAll = false) {
  if (forceAll) return true
  const slug = String(connName || '').toLowerCase()
  for (const [key, re] of Object.entries(MCP_KEYWORD_HINTS)) {
    if (slug.includes(key.replace(/\s+/g, '')) || slug.includes(key)) {
      if (re.test(userText)) return true
    }
  }
  for (const re of Object.values(MCP_KEYWORD_HINTS)) {
    if (re.test(userText)) return true
  }
  return false
}

assert.equal(shouldUseTokenOptimize({ metadata: {} }, true), true)
assert.equal(shouldUseTokenOptimize({ metadata: { token_optimize: false } }, true), false)
assert.ok(buildQuickAck('בדיקת דופק').includes('קיבלתי'))
assert.equal(shouldLoadMcpConnection('Gmail', 'שלחי מייל ללקוח'), true)
assert.equal(shouldLoadMcpConnection('Gmail', 'מה מצב הלידים'), false)

console.log('carmen-token-optimizer.test.mjs: ok')
