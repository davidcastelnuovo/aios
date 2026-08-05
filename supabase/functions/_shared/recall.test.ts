import assert from 'node:assert/strict'
import test from 'node:test'
import { recallTranscriptToText } from './recall.ts'

// Shape of Recall's v1.11 transcript download: a top-level array of
// per-participant segments, each holding a flat list of words.
const v111Download = [
  {
    participant: { id: 1, name: 'דוד' },
    language_code: 'he',
    words: [
      { text: 'שלום', start_timestamp: { relative: 0.5 } },
      { text: 'כרמן', start_timestamp: { relative: 1.0 } },
      // 10s pause — should start a new line for the same speaker.
      { text: 'נתחיל', start_timestamp: { relative: 11.0 } },
    ],
  },
  {
    participant: { id: 2, name: 'רונית' },
    language_code: 'he',
    words: [
      { text: 'בוקר', start_timestamp: { relative: 3.0 } },
      { text: 'טוב', start_timestamp: { relative: 3.4 } },
    ],
  },
]

test('parses the v1.11 top-level array download into a speaker timeline', () => {
  const text = recallTranscriptToText(v111Download)
  assert.equal(
    text,
    ['[00:00] דוד: שלום כרמן', '[00:03] רונית: בוקר טוב', '[00:11] דוד: נתחיל'].join('\n'),
  )
})

test('orders lines by timestamp across participants', () => {
  const lines = recallTranscriptToText(v111Download).split('\n')
  assert.deepEqual(lines.map((l) => l.slice(1, 6)), ['00:00', '00:03', '00:11'])
})

test('returns empty string for a transcript with no words yet', () => {
  assert.equal(recallTranscriptToText([]), '')
  assert.equal(recallTranscriptToText([{ participant: { id: 1, name: 'דוד' }, words: [] }]), '')
})

test('falls back to participant names when a segment has no display name', () => {
  const text = recallTranscriptToText([
    { participant: { id: 7 }, words: [{ text: 'בדיקה', start_timestamp: { relative: 2 } }] },
  ])
  assert.equal(text, '[00:02] משתתף: בדיקה')
})

test('still supports the utterances schema', () => {
  const text = recallTranscriptToText({
    utterances: [
      {
        participant: { id: 1, name: 'דוד' },
        words: [{ text: 'היי', start_timestamp: { relative: 0 } }],
      },
    ],
  })
  assert.equal(text, '[00:00] דוד: היי')
})

test('still supports a plain text transcript', () => {
  assert.equal(recallTranscriptToText({ text: 'תמלול פשוט' }), 'תמלול פשוט')
})
